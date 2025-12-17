// api/scheduled-sync.js
// Scheduled function to automatically sync all states daily

export default async function handler(req, res) {
  // Verify this is a Vercel Cron request
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const states = [
    'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
    'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md',
    'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
    'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
    'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
    'dc', 'pr'
  ];

  const results = {
    success: [],
    failed: [],
    total: states.length,
  };

  // Process states in batches to avoid timeout
  const batchSize = 5;
  for (let i = 0; i < states.length; i += batchSize) {
    const batch = states.slice(i, i + batchSize);
    
    await Promise.allSettled(
      batch.map(async (state) => {
        try {
          const response = await fetch(
            `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/sync-bills`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`,
              },
              body: JSON.stringify({ state, limit: 100 }),
            }
          );

          if (response.ok) {
            results.success.push(state);
          } else {
            results.failed.push({ state, error: await response.text() });
          }
        } catch (error) {
          results.failed.push({ state, error: error.message });
        }
      })
    );

    // Add a small delay between batches
    if (i + batchSize < states.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return res.status(200).json({
    message: 'Scheduled sync completed',
    successCount: results.success.length,
    failedCount: results.failed.length,
    results,
  });
}
