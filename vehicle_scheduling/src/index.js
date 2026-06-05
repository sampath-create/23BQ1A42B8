const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'http://4.224.186.213/evaluation-service';
const CREDS = {
  email: "sampath2005h@gmail.com",
  rollNo: "23bq1a42b8",
  clientID: "dbafb962-db1e-4008-ac61-e22f5cbc4944",
  clientSecret: "HbHgQMTJnkAwJeDj",
  name: "nadamaluru sampath kumar",
  accessCode: "QQdEYy"
};

async function log(stack, level, pkg, message) {
  try {
    await fetch(`${BASE_URL}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stack, level, package: pkg, message })
    });
  } catch (err) {
    console.error("Logging failed:", err.message);
  }
}

function solveKnapsack(tasks, maxHours) {
  const capacity = Math.round(maxHours * 10);
  const dp = Array(capacity + 1).fill(0);
  const picked = Array(capacity + 1).fill(null).map(() => []);

  for (const task of tasks) {
    const weight = Math.round(task.Duration * 10);
    const value = task.Impact;

    if (weight > capacity) continue;

    for (let w = capacity; w >= weight; w--) {
      if (dp[w - weight] + value > dp[w]) {
        dp[w] = dp[w - weight] + value;
        picked[w] = [...picked[w - weight], task];
      }
    }
  }

  return {
    totalScore: dp[capacity],
    totalDuration: picked[capacity].reduce((sum, t) => sum + t.Duration, 0),
    selectedTasks: picked[capacity]
  };
}

app.get('/schedule', async (req, res) => {
  await log("GET /schedule", "info", "vehicle_scheduling", "Received request to generate schedule");
  try {
    let authRes = await fetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDS)
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      await log("Auth", "error", "vehicle_scheduling", `Auth failed: ${errText}`);
      return res.status(authRes.status).json({ error: "Auth failed", details: errText });
    }
    const { access_token } = await authRes.json();
    const headers = { 'Authorization': `Bearer ${access_token}` };

    let depotsRes = await fetch(`${BASE_URL}/depots`, { headers });
    const { depots } = await depotsRes.json();
    console.log("Sample depot:", JSON.stringify(depots[0]));
    await log("Fetch Depots", "info", "vehicle_scheduling", `Fetched ${depots.length} depots`);

    let vehiclesRes = await fetch(`${BASE_URL}/vehicles`, { headers });
    const { vehicles } = await vehiclesRes.json();
    console.log("Sample vehicle:", JSON.stringify(vehicles[0]));
    await log("Fetch Vehicles", "info", "vehicle_scheduling", `Fetched ${vehicles.length} vehicles`);

    const results = [];

    for (const depot of depots) {
      const schedule = solveKnapsack(vehicles, depot.MechanicHours);

      results.push({
        depotId: depot.ID,
        availableHours: depot.MechanicHours,
        usedHours: schedule.totalDuration,
        totalScore: schedule.totalScore,
        tasksPicked: schedule.selectedTasks.map(t => t.TaskID)
      });
    }

    await log("Scheduling", "info", "vehicle_scheduling", "Successfully calculated knapsack schedules for all depots");
    res.json({ success: true, data: results });

  } catch (err) {
    await log("Error Handler", "error", "vehicle_scheduling", `Unexpected error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || err });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Test in Postman by sending a GET request to http://localhost:${PORT}/schedule`);
});
