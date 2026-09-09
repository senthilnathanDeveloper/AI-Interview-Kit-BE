const fs = require('fs');
const path = require('path');
const { runPipeline } = require('./src/services/pipeline');

// Parse command line flags: --input <path> --output <path>
function parseArgs() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    }
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    process.exit(1);
  }

  return { inputPath, outputPath };
}

const mongoose = require('mongoose');
const Kit = require('./src/models/Kit');

async function main() {
  const { inputPath, outputPath } = parseArgs();

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  const resolvedOutput = path.resolve(process.cwd(), outputPath);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`Input file not found: ${resolvedInput}`);
    process.exit(1);
  }

  // Connect to MongoDB if available
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-interview-kit';
  let dbConnected = false;
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    console.log(`[Batch Evaluator] Connected to MongoDB at ${MONGODB_URI}`);
  } catch (dbErr) {
    console.warn(`[Batch Evaluator] MongoDB connection skipped: ${dbErr.message}`);
  }

  let cases = [];
  try {
    const rawData = fs.readFileSync(resolvedInput, 'utf8');
    cases = JSON.parse(rawData);
    if (!Array.isArray(cases)) {
      throw new Error('Input file must contain a JSON array of case objects.');
    }
  } catch (err) {
    console.error(`Failed to parse input file: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Batch Evaluator] Processing ${cases.length} input cases...`);

  const results = [];

  for (let idx = 0; idx < cases.length; idx++) {
    const c = cases[idx];
    const caseId = c.id || `case-${idx + 1}`;
    console.log(`\n[${idx + 1}/${cases.length}] Running case: ${caseId} (${c.company_url || 'No URL'})`);

    try {
      const generatedKit = await runPipeline({
        jd: c.jd,
        company_url: c.company_url,
        days: c.days || 5,
        onProgress: p => console.log(`  -> [${p.stage}] ${p.message}`)
      });

      // Save to MongoDB collection if connected
      if (dbConnected) {
        try {
          const kitDoc = new Kit({
            caseId: caseId,
            title: `${generatedKit.role.title} @ ${generatedKit.source.company}`,
            company: generatedKit.source.company,
            kitData: generatedKit
          });
          await kitDoc.save();
          console.log(`  ✓ Saved document to MongoDB 'kits' collection.`);
        } catch (saveErr) {
          console.warn(`  ! Could not save to MongoDB: ${saveErr.message}`);
        }
      }

      results.push({
        id: caseId,
        status: 'ok',
        kit: generatedKit,
        error: null
      });
      console.log(`  ✓ Case ${caseId} completed successfully.`);
    } catch (err) {
      console.error(`  ✗ Case ${caseId} failed: ${err.message}`);
      
      // Determine error code
      let code = 'PIPELINE_ERROR';
      if (err.message.includes('UNREACHABLE') || err.message.includes('ECONNREFUSED') || err.message.includes('404')) {
        code = 'COMPANY_UNREACHABLE';
      }

      results.push({
        id: caseId,
        status: 'failed',
        kit: null,
        error: {
          code,
          message: err.message
        }
      });
    }
  }

  const outputPayload = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results
  };

  // Ensure output directory exists
  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(resolvedOutput, JSON.stringify(outputPayload, null, 2), 'utf8');
  console.log(`\n[Batch Evaluator] Finished! Wrote results for ${results.length} cases to ${resolvedOutput}`);

  if (dbConnected) {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error(`Fatal batch runner error:`, err);
  process.exit(1);
});
