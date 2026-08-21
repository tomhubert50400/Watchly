#import "WatchlyDiscordAuthBridge.h"

#define DISCORDPP_IMPLEMENTATION
#include <discord_partner_sdk/discordpp.h>

#include <memory>
#include <string>
#include <utility>

static NSString * const WatchlyDiscordAuthErrorDomain = @"WatchlyDiscordAuth";

@interface WatchlyDiscordAuthBridge () {
  std::unique_ptr<discordpp::Client> _client;
  dispatch_source_t _callbackTimer;
  WatchlyDiscordAuthCompletion _completion;
}
@end

@implementation WatchlyDiscordAuthBridge

- (void)authorizeWithClientId:(NSString *)clientId
                   completion:(WatchlyDiscordAuthCompletion)completion {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self->_completion != nil) {
      completion(nil, [self errorWithCode:1 message:@"Discord authorization is already running."]);
      return;
    }

    NSScanner *scanner = [NSScanner scannerWithString:clientId];
    unsigned long long applicationId = 0;
    if (![scanner scanUnsignedLongLong:&applicationId] || !scanner.isAtEnd || applicationId == 0) {
      completion(nil, [self errorWithCode:2 message:@"The Discord application ID is invalid."]);
      return;
    }

    self->_completion = [completion copy];
    self->_client = std::make_unique<discordpp::Client>();

    discordpp::AuthorizationCodeVerifier codeVerifier =
      self->_client->CreateAuthorizationCodeVerifier();
    std::string verifier = codeVerifier.Verifier();

    discordpp::AuthorizationArgs args{};
    args.SetClientId(applicationId);
    args.SetScopes("identify email");
    args.SetCodeChallenge(codeVerifier.Challenge());

    [self startCallbackTimer];

    __weak WatchlyDiscordAuthBridge *weakSelf = self;
    self->_client->Authorize(
      std::move(args),
      [weakSelf, verifier = std::move(verifier)](
        discordpp::ClientResult result,
        std::string code,
        std::string redirectUri
      ) {
        WatchlyDiscordAuthBridge *strongSelf = weakSelf;
        if (strongSelf == nil) return;

        if (!result.Successful()) {
          std::string message = result.Error();
          NSString *errorMessage = message.empty()
            ? @"Discord authorization failed."
            : [NSString stringWithUTF8String:message.c_str()];
          dispatch_async(dispatch_get_main_queue(), ^{
            [strongSelf finishWithResult:nil error:[strongSelf errorWithCode:3 message:errorMessage]];
          });
          return;
        }

        NSString *authorizationCode = [NSString stringWithUTF8String:code.c_str()];
        NSString *callbackUri = [NSString stringWithUTF8String:redirectUri.c_str()];
        NSString *codeVerifierValue = [NSString stringWithUTF8String:verifier.c_str()];

        dispatch_async(dispatch_get_main_queue(), ^{
          [strongSelf finishWithResult:@{
            @"code": authorizationCode,
            @"redirectUri": callbackUri,
            @"codeVerifier": codeVerifierValue,
          } error:nil];
        });
      }
    );
  });
}

- (void)startCallbackTimer {
  _callbackTimer = dispatch_source_create(
    DISPATCH_SOURCE_TYPE_TIMER,
    0,
    0,
    dispatch_get_main_queue()
  );
  dispatch_source_set_timer(
    _callbackTimer,
    dispatch_time(DISPATCH_TIME_NOW, 0),
    16 * NSEC_PER_MSEC,
    2 * NSEC_PER_MSEC
  );
  dispatch_source_set_event_handler(_callbackTimer, ^{
    discordpp::RunCallbacks();
  });
  dispatch_resume(_callbackTimer);
}

- (void)finishWithResult:(NSDictionary<NSString *, NSString *> * _Nullable)result
                    error:(NSError * _Nullable)error {
  WatchlyDiscordAuthCompletion completion = _completion;
  _completion = nil;

  if (_callbackTimer != nil) {
    dispatch_source_cancel(_callbackTimer);
    _callbackTimer = nil;
  }
  _client.reset();

  if (completion != nil) completion(result, error);
}

- (NSError *)errorWithCode:(NSInteger)code message:(NSString *)message {
  return [NSError errorWithDomain:WatchlyDiscordAuthErrorDomain
                             code:code
                         userInfo:@{ NSLocalizedDescriptionKey: message }];
}

- (void)dealloc {
  if (_client != nullptr) _client->AbortAuthorize();
  if (_callbackTimer != nil) dispatch_source_cancel(_callbackTimer);
}

@end
