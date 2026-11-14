// L4 on Wear OS: shows the run the phone is recording and sends Start /
// Pause / Resume / End. The phone keeps the GPS and scores the run.
package app.runivo.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

private const val STATE_PATH = "/runivo/state"
private const val COMMAND_PATH = "/runivo/command"
private val Red = Color(0xFFFF4518)

data class RunState(
  val phase: String = "ready", val distance: String = "0.00", val unit: String = "km",
  val time: String = "0:00", val pace: String = "–:––", val paceLabel: String = "Pace /km", val zone: String = "",
)

class MainActivity : ComponentActivity(), MessageClient.OnMessageReceivedListener {
  private val state = mutableStateOf(RunState())
  private val phoneConnected = mutableStateOf(false)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent { MaterialTheme { RunScreen(state.value, phoneConnected.value) { send(it) } } }
  }

  override fun onResume() {
    super.onResume()
    Wearable.getMessageClient(this).addListener(this)
    Wearable.getNodeClient(this).connectedNodes.addOnSuccessListener { phoneConnected.value = it.isNotEmpty() }
  }

  override fun onPause() {
    Wearable.getMessageClient(this).removeListener(this)
    super.onPause()
  }

  override fun onMessageReceived(event: MessageEvent) {
    if (event.path != STATE_PATH) return
    val j = JSONObject(String(event.data, Charsets.UTF_8))
    state.value = RunState(
      phase = j.optString("phase", "ready"), distance = j.optString("distance", "0.00"), unit = j.optString("unit", "km"),
      time = j.optString("time", "0:00"), pace = j.optString("pace", "–:––"), paceLabel = j.optString("paceLabel", "Pace /km"),
      zone = j.optString("zone", ""),
    )
    phoneConnected.value = true
  }

  private fun send(command: String) {
    Wearable.getNodeClient(this).connectedNodes.addOnSuccessListener { nodes ->
      val client = Wearable.getMessageClient(this)
      nodes.forEach { client.sendMessage(it.id, COMMAND_PATH, command.toByteArray(Charsets.UTF_8)) }
    }
  }
}

@Composable
fun RunScreen(s: RunState, connected: Boolean, onCommand: (String) -> Unit) {
  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 18.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    if (!connected && s.phase == "ready") {
      Text("Open Runivo on your phone to start", fontSize = 12.sp, textAlign = TextAlign.Center, color = Color.Gray)
      Spacer(Modifier.height(6.dp))
    }
    Text(s.distance, fontSize = 38.sp, fontWeight = FontWeight.Black)
    Text(s.unit, fontSize = 11.sp, color = Color.Gray)
    Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
      Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(s.time, fontSize = 15.sp, fontWeight = FontWeight.Bold); Text("Time", fontSize = 10.sp, color = Color.Gray) }
      Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(s.pace, fontSize = 15.sp, fontWeight = FontWeight.Bold); Text(s.paceLabel, fontSize = 10.sp, color = Color.Gray) }
    }
    if (s.zone.isNotEmpty()) Text(s.zone, fontSize = 11.sp, color = Red)
    Spacer(Modifier.height(8.dp))
    when (s.phase) {
      "running" -> Button(onClick = { onCommand("pause") }, colors = ButtonDefaults.buttonColors(backgroundColor = Color(0xFFE0B000))) { Text("Pause") }
      "paused" -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { onCommand("resume") }, colors = ButtonDefaults.buttonColors(backgroundColor = Color(0xFF1A8F5A))) { Text("Go") }
        Button(onClick = { onCommand("end") }, colors = ButtonDefaults.buttonColors(backgroundColor = Red)) { Text("End") }
      }
      "done" -> Text("Saved on your phone", fontSize = 12.sp, color = Color.Gray)
      else -> Button(onClick = { onCommand("start") }, enabled = connected, colors = ButtonDefaults.buttonColors(backgroundColor = Red)) { Text("Start") }
    }
  }
}
