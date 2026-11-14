// L4, phone side on Android: sends the live run to the Runivo Wear OS app and
// receives its Start / Pause / Resume / End taps over the Wearable Data Layer.
// Same module name and API as the iOS side, so the JS is shared.
package expo.modules.runivowatch

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

const val STATE_PATH = "/runivo/state"
const val COMMAND_PATH = "/runivo/command"

class RunivoWatchModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  @Volatile private var nodes: List<Node> = emptyList()

  private val listener = MessageClient.OnMessageReceivedListener { event: MessageEvent ->
    if (event.path == COMMAND_PATH) {
      sendEvent("onCommand", mapOf("command" to String(event.data, Charsets.UTF_8)))
    }
  }

  private fun refreshNodes() {
    val ctx = context ?: return
    Wearable.getNodeClient(ctx).connectedNodes.addOnSuccessListener { found -> nodes = found }
  }

  override fun definition() = ModuleDefinition {
    Name("RunivoWatch")
    Events("onCommand")

    OnCreate {
      context?.let { Wearable.getMessageClient(it).addListener(listener) }
      refreshNodes()
    }

    OnDestroy {
      context?.let { Wearable.getMessageClient(it).removeListener(listener) }
    }

    Function("isAvailable") {
      refreshNodes()
      nodes.isNotEmpty()
    }

    Function("sendState") { state: Map<String, Any?> ->
      val ctx = context ?: return@Function
      val bytes = JSONObject(state.filterValues { it != null }).toString().toByteArray(Charsets.UTF_8)
      val client = Wearable.getMessageClient(ctx)
      for (node in nodes) client.sendMessage(node.id, STATE_PATH, bytes)
    }
  }
}
