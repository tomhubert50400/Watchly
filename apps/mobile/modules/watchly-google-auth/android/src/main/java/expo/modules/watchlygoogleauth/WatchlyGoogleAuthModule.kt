package expo.modules.watchlygoogleauth

import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class WatchlyGoogleAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WatchlyGoogleAuth")

    AsyncFunction("signIn") Coroutine { webClientId: String ->
      withContext(Dispatchers.Main) {
        val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
        val request = GetCredentialRequest.Builder()
          .addCredentialOption(GetSignInWithGoogleOption.Builder(webClientId).build())
          .build()

        try {
          val credential = CredentialManager.create(activity)
            .getCredential(activity, request).credential
          check(credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "Google did not return an ID token."
          }
          GoogleIdTokenCredential.createFrom(credential.data).idToken
        } catch (_: GetCredentialCancellationException) {
          null
        }
      }
    }

    AsyncFunction("clearSession") Coroutine { ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
    }
  }
}
