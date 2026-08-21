#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^WatchlyDiscordAuthCompletion)(
  NSDictionary<NSString *, NSString *> * _Nullable result,
  NSError * _Nullable error
);

@interface WatchlyDiscordAuthBridge : NSObject

- (void)authorizeWithClientId:(NSString *)clientId
                   completion:(WatchlyDiscordAuthCompletion)completion;

@end

NS_ASSUME_NONNULL_END
