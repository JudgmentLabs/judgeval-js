import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Example } from '../../data/example.js';
import { EvalDataset } from '../../data/datasets/eval-dataset.js';
import { EvalDatasetClient } from '../../data/datasets/eval-dataset-client.js';
import logger from '../../common/logger-instance.js';

// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const apiKey = process.env.JUDGMENT_API_KEY;
const orgId = process.env.JUDGMENT_ORG_ID;

if (!apiKey || !orgId) {
  logger.error('Error: JUDGMENT_API_KEY and JUDGMENT_ORG_ID must be set in the .env file.');
  process.exit(1);
}

// --- Configuration ---
const DEMO_PROJECT_NAME = 'test-bot-ts';
const DEMO_DATASET_ALIAS = 'ts-demo-dataset';
const TEMP_DIR = path.join(__dirname, 'temp_dataset_files'); // Create a temporary directory for saved files

// Helper function to clean up temp files
const cleanupTempFiles = () => {
  if (fs.existsSync(TEMP_DIR)) {
    logger.info(`Cleaning up temporary files in ${TEMP_DIR}...`);
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    logger.info('Cleanup complete.');
  }
};

// Main demo function
async function runDatasetDemo() {
  logger.info('--- Starting EvalDataset Demo ---');

  // Ensure temp directory exists and is empty
  cleanupTempFiles(); // Clean up from previous runs if any
  fs.mkdirSync(TEMP_DIR);

  // 1. Initialize Client
  logger.info('1. Initializing EvalDatasetClient...');
  const client = new EvalDatasetClient(apiKey as string, orgId as string);

  // 2. Create Examples and Dataset
  logger.info('\n2. Creating Examples and EvalDataset...');
  const example1 = new Example({
    input: 'What is the capital of France?',
    actualOutput: 'Paris is the capital of France.',
    expectedOutput: 'Paris',
    context: ['Geography question'],
    traceId: 'trace-001',
    name: 'Capital Question',
  });
  const example2 = new Example({
    input: 'Translate \'hello\' to Spanish.',
    actualOutput: 'Hola',
    expectedOutput: 'Hola',
    toolsCalled: ['translation_tool'],
    traceId: 'trace-002',
  });
  const initialDataset = client.createDataset([example1, example2]);
  logger.info(`Initial dataset created with ${initialDataset.length} examples.`);

  // 3. Save Dataset Locally
  logger.info('\n3. Saving dataset locally...');
  try {
    initialDataset.saveAs('json', TEMP_DIR, 'local_demo_data');
    logger.info(` - Saved as JSON: ${path.join(TEMP_DIR, 'local_demo_data.json')}`);
    initialDataset.saveAs('yaml', TEMP_DIR, 'local_demo_data');
    logger.info(` - Saved as YAML: ${path.join(TEMP_DIR, 'local_demo_data.yaml')}`);
    initialDataset.saveAs('csv', TEMP_DIR, 'local_demo_data');
    logger.info(` - Saved as CSV: ${path.join(TEMP_DIR, 'local_demo_data.csv')}`);
  } catch (error) {
    logger.error('Error saving dataset locally:', error);
  }

  // 4. Load Dataset Locally
  logger.info('\n4. Loading dataset locally...');
  try {
    const loadedFromJson = client.createDataset();
    loadedFromJson.addFromJson(path.join(TEMP_DIR, 'local_demo_data.json'));
    logger.info(` - Loaded ${loadedFromJson.length} examples from JSON.`);

    const loadedFromYaml = client.createDataset();
    loadedFromYaml.addFromYaml(path.join(TEMP_DIR, 'local_demo_data.yaml'));
    logger.info(` - Loaded ${loadedFromYaml.length} examples from YAML.`);

    const loadedFromCsv = client.createDataset();
    // Define header mapping for CSV (camelCase keys, CSV header values)
    const csvHeaderMapping = {
      input: 'input',
      actualOutput: 'actual_output',
      expectedOutput: 'expected_output',
      context: 'context',
      retrievalContext: 'retrieval_context', // Even if not used in save, include for loading flexibility
      additionalMetadata: 'additional_metadata',
      toolsCalled: 'tools_called',
      expectedTools: 'expected_tools',
      name: 'name',
      exampleId: 'example_id',
      exampleIndex: 'example_index',
      timestamp: 'timestamp',
      traceId: 'trace_id',
      example: 'example',
    };
    loadedFromCsv.addFromCsv(path.join(TEMP_DIR, 'local_demo_data.csv'), csvHeaderMapping);
    logger.info(` - Loaded ${loadedFromCsv.length} examples from CSV.`);

  } catch (error) {
    logger.error('Error loading dataset locally:', error);
  }

  // --- Interact with Judgment Platform ---
  logger.info('\n--- Interacting with Judgment Platform ---');
  let datasetExists = false;

  // Ensure dataset doesn't exist before pushing (or use overwrite)
  logger.info(`Checking if dataset '${DEMO_DATASET_ALIAS}' exists in project '${DEMO_PROJECT_NAME}'...`);
  try {
      // Attempt to pull to check existence - might throw 404 if not found
      await client.pullDataset(DEMO_DATASET_ALIAS, DEMO_PROJECT_NAME);
      logger.warn(`Dataset '${DEMO_DATASET_ALIAS}' already exists. Will use overwrite=true or append/insert.`);
      datasetExists = true;
  } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
          logger.info(`Dataset '${DEMO_DATASET_ALIAS}' does not exist yet. Proceeding with push.`);
          datasetExists = false;
      } else {
          logger.warn(`Could not determine if dataset exists due to potential error (may proceed with overwrite):`, error.message);
          // Assume it might exist, proceed cautiously
          datasetExists = true;
      }
  }

  // 5. Push Dataset
  logger.info(`\n5. Pushing dataset '${DEMO_DATASET_ALIAS}' to project '${DEMO_PROJECT_NAME}'...`);
  try {
    // Use overwrite=true if we know it exists or are unsure, otherwise false
    const pushSuccess = await client.pushDataset(initialDataset, DEMO_DATASET_ALIAS, DEMO_PROJECT_NAME, datasetExists);
    if (pushSuccess) {
      logger.info('Push successful.');
      datasetExists = true; // Mark as existing after successful push
    } else {
      logger.error('Push failed.');
    }
  } catch (error) {
    logger.error('Error pushing dataset:', error);
  }

  // 6. Append Examples
  logger.info(`\n6. Appending examples to dataset '${DEMO_DATASET_ALIAS}'...`);
  if (datasetExists) {
    const example3 = new Example({
      input: 'Who painted the Mona Lisa?',
      actualOutput: 'Leonardo da Vinci painted the Mona Lisa.',
      additionalMetadata: { tags: ['art', 'history'] },
      traceId: 'trace-003',
    });
    try {
      const appendSuccess = await client.append(DEMO_DATASET_ALIAS, [example3], DEMO_PROJECT_NAME);
      if (appendSuccess) {
        logger.info('Append successful.');
      } else {
        logger.error('Append failed.');
      }
    } catch (error) {
      logger.error('Error appending examples:', error);
    }
  } else {
    logger.warn('Skipping append because initial push failed or dataset did not exist.');
  }

  // 7. Insert Examples (Similar to Append, different endpoint)
  logger.info(`\n7. Inserting examples into dataset '${DEMO_DATASET_ALIAS}'...`);
  if (datasetExists) {
      const example4 = new Example({
        input: 'What is 2 + 2?',
        actualOutput: '4',
        expectedOutput: '4',
        traceId: 'trace-004',
      });
      try {
          const insertSuccess = await client.insertDataset(DEMO_DATASET_ALIAS, [example4], DEMO_PROJECT_NAME);
          if (insertSuccess) {
              logger.info('Insert successful.');
          } else {
              logger.error('Insert failed.');
          }
      } catch (error) {
          logger.error('Error inserting examples:', error);
      }
  } else {
      logger.warn('Skipping insert because initial push failed or dataset did not exist.');
  }

  // 8. Pull Dataset
  logger.info(`\n8. Pulling dataset '${DEMO_DATASET_ALIAS}' from project '${DEMO_PROJECT_NAME}'...`);
  let pulledDataset: EvalDataset | null = null;
  if (datasetExists) {
    try {
      pulledDataset = await client.pullDataset(DEMO_DATASET_ALIAS, DEMO_PROJECT_NAME);
      logger.info(`Pulled dataset with ${pulledDataset.length} examples.`);
      // Optionally print examples
      // console.log('Pulled Examples:', pulledDataset.examples.map(e => e.toJSON()));
    } catch (error) {
      logger.error('Error pulling dataset:', error);
    }
  } else {
     logger.warn('Skipping pull because dataset likely does not exist on the server.');
  }

  // 9. Pull Project Dataset Stats
  logger.info(`\n9. Pulling dataset stats for project '${DEMO_PROJECT_NAME}'...`);
  try {
    const stats = await client.pullProjectDatasetStats(DEMO_PROJECT_NAME);
    logger.info('Project Dataset Stats:');
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    logger.error('Error pulling project stats:', error);
  }

  // 10. Export Dataset as JSONL
  logger.info(`\n10. Exporting dataset '${DEMO_DATASET_ALIAS}' as JSONL...`);
  if (datasetExists) {
      const jsonlFilePath = path.join(TEMP_DIR, `${DEMO_DATASET_ALIAS}_export.jsonl`);
      try {
          const response = await client.exportJsonl(DEMO_DATASET_ALIAS, DEMO_PROJECT_NAME);
          const writer = fs.createWriteStream(jsonlFilePath);
          response.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
              writer.on('finish', () => resolve());
              writer.on('error', (err) => reject(err));
              response.data.on('error', (err: any) => reject(err));
          });
          logger.info(`Dataset exported successfully to ${jsonlFilePath}`);

      } catch (error) {
          logger.error('Error exporting dataset as JSONL:', error);
      }
  } else {
      logger.warn('Skipping export because dataset likely does not exist on the server.');
  }

  // 11. Delete Dataset (Cleanup on Server)
  logger.info(`\n11. Deleting dataset '${DEMO_DATASET_ALIAS}' from project '${DEMO_PROJECT_NAME}'...`);
  if (datasetExists) { // Only delete if we think it was created
      try {
          const deleteSuccess = await client.deleteDataset(DEMO_DATASET_ALIAS, DEMO_PROJECT_NAME);
          if (deleteSuccess) {
              logger.info('Delete successful.');
          } else {
              logger.error('Delete failed.');
          }
      } catch (error) {
          logger.error('Error deleting dataset:', error);
      }
  } else {
       logger.warn('Skipping delete because dataset was likely never created on the server.');
  }

  logger.info('\n--- Dataset Demo Complete ---');

  // Final cleanup of local files
  cleanupTempFiles();
}

// Import axios for error checking (needed in the check block)
import axios from 'axios';

// Execute the demo
runDatasetDemo().catch((error) => {
  logger.error('\n--- Demo encountered an unhandled error: ---');
  console.error(error);
  cleanupTempFiles(); // Attempt cleanup even on error
  process.exit(1);
}); 