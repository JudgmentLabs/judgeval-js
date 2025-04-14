import { Example, ExampleOptions } from '../example.js'; // Import class and options
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse'; // Added PapaParse
import YAML from 'js-yaml'; // Added js-yaml
import { format } from 'date-fns'; // For default filename timestamp
// We'll need libraries for CSV and YAML parsing/writing later
// import Papa from 'papaparse';
// import YAML from 'js-yaml';

// Define acceptable save file types
type SaveFileType = 'json' | 'csv' | 'yaml';
const ACCEPTABLE_FILE_TYPES: SaveFileType[] = ['json', 'csv', 'yaml'];

// Define keys that represent lists potentially split by a delimiter in CSV
// Use camelCase names from Example class/ExampleOptions
const LIST_LIKE_KEYS: (keyof ExampleOptions)[] = [
  'context',
  'retrievalContext',
  'toolsCalled',
  'expectedTools',
];

export class EvalDataset {
  public examples: Example[];
  private _alias: string | null;
  private _id: string | null;
  // These might not be needed directly in the TS class if client handles auth
  // public judgment_api_key: string;
  // public organization_id: string;

  constructor(examples: Example[] = []) {
    console.debug(`Initializing EvalDataset with ${examples.length} examples`);
    this.examples = examples;
    this._alias = null;
    this._id = null;
    // Assuming API keys are handled by the client, not stored in the dataset object itself
    // this.judgment_api_key = judgment_api_key || process.env.JUDGMENT_API_KEY || '';
    // this.organization_id = organization_id || process.env.JUDGMENT_ORG_ID || '';
    // if (!this.judgment_api_key) {
    //   console.warn("No judgment_api_key provided");
    // }
  }

  public addExample(e: Example): void {
    this.examples.push(e);
  }

  public get length(): number {
    return this.examples.length;
  }

  public get alias(): string | null {
    return this._alias;
  }

  public set alias(value: string | null) {
    this._alias = value;
  }

  public get id(): string | null {
    return this._id;
  }

  public set id(value: string | null) {
    this._id = value;
  }

  /**
   * Adds examples from a JSON file.
   * Assumes the JSON file has a top-level key "examples" containing an array of example objects.
   * @param filePath Path to the JSON file.
   */
  public addFromJson(filePath: string): void {
    console.debug(`Loading dataset from JSON file: ${filePath}`);
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const payload = JSON.parse(fileContent);
      const examplesFromJson = payload?.examples;

      if (!Array.isArray(examplesFromJson)) {
        throw new Error(
          'Invalid JSON format: "examples" key not found or not an array.',
        );
      }

      console.info(`Adding ${examplesFromJson.length} examples from JSON`);
      examplesFromJson.forEach((e: any) => {
        // Map snake_case from file to camelCase for ExampleOptions
        const options: ExampleOptions = {
          input: e.input,
          actualOutput: e.actual_output,
          expectedOutput: e.expected_output,
          context: e.context,
          retrievalContext: e.retrieval_context,
          additionalMetadata: e.additional_metadata,
          toolsCalled: e.tools_called,
          expectedTools: e.expected_tools,
          name: e.name,
          exampleId: e.example_id,
          exampleIndex: e.example_index,
          timestamp: e.timestamp,
          traceId: e.trace_id,
          example: e.example,
        };
        // TODO: Add handling for fields not in ExampleOptions (name, comments, etc.) if needed
        this.addExample(new Example(options));
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`JSON file not found: ${filePath}`);
        throw new Error(`The file ${filePath} was not found.`);
      } else if (error instanceof SyntaxError) {
        console.error(`Invalid JSON file: ${filePath}`, error);
        throw new Error(`The file ${filePath} is not a valid JSON file.`);
      } else {
        console.error(`Error loading dataset from JSON: ${filePath}`, error);
        throw error; // Re-throw other errors
      }
    }
  }

  /**
   * Adds examples from a YAML file.
   * Assumes the YAML file has a top-level key "examples" containing an array of example objects.
   * @param filePath Path to the YAML file.
   */
  public addFromYaml(filePath: string): void {
    console.debug(`Loading dataset from YAML file: ${filePath}`);
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const payload = YAML.load(fileContent) as { examples?: any[] };

      if (!payload) {
        throw new Error('The YAML file is empty.');
      }

      const examplesFromYaml = payload?.examples;

      if (!Array.isArray(examplesFromYaml)) {
        throw new Error(
          'Invalid YAML format: "examples" key not found or not an array.',
        );
      }

      console.info(`Adding ${examplesFromYaml.length} examples from YAML`);
      examplesFromYaml.forEach((e: any) => {
        // Map snake_case from file to camelCase for ExampleOptions
        const options: ExampleOptions = {
          input: e.input,
          actualOutput: e.actual_output,
          expectedOutput: e.expected_output,
          context: e.context,
          retrievalContext: e.retrieval_context,
          additionalMetadata: e.additional_metadata,
          toolsCalled: e.tools_called,
          expectedTools: e.expected_tools,
          name: e.name,
          exampleId: e.example_id,
          exampleIndex: e.example_index,
          timestamp: e.timestamp,
          traceId: e.trace_id,
          example: e.example,
        };
        this.addExample(new Example(options));
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`YAML file not found: ${filePath}`);
        throw new Error(`The file ${filePath} was not found.`);
      } else if (error instanceof YAML.YAMLException) {
        console.error(`Invalid YAML file: ${filePath}`, error);
        throw new Error(`The file ${filePath} is not a valid YAML file.`);
      } else {
        console.error(`Error loading dataset from YAML: ${filePath}`, error);
        throw error; // Re-throw other errors
      }
    }
  }

  /**
   * Adds examples from a CSV file.
   * @param filePath Path to the CSV file.
   * @param headerMapping Dictionary mapping Example headers (keys) to custom headers in the CSV (values).
   * @param primaryDelimiter Main delimiter used in CSV file. Defaults to ",".
   * @param secondaryDelimiter Secondary delimiter for list fields (context, retrieval_context, etc.). Defaults to ";".
   */
  public addFromCsv(
    filePath: string,
    // headerMapping values are CSV headers, keys need to be ExampleOptions properties (camelCase)
    headerMapping: { [key in keyof ExampleOptions]?: string },
    primaryDelimiter: string = ',',
    secondaryDelimiter: string = ';',
  ): void {
    console.debug(`Loading dataset from CSV file: ${filePath}`);
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Invert headerMapping for easier lookup: CSV Header -> ExampleOption Key
      const csvHeaderToExampleKeyMap = Object.entries(headerMapping).reduce(
        (acc, [exampleKey, csvHeader]) => {
          if (csvHeader) acc[csvHeader] = exampleKey as keyof ExampleOptions;
          return acc;
        },
        {} as Record<string, keyof ExampleOptions>,
      );

      const parseResult = Papa.parse(fileContent, {
        header: true,
        delimiter: primaryDelimiter,
        skipEmptyLines: true,
        dynamicTyping: (field: string | number) => {
          const exampleKey = csvHeaderToExampleKeyMap[field];
          // Prevent auto-typing traceId
          if (exampleKey === 'traceId') return false;
          return true;
        },
      });

      if (parseResult.errors.length > 0) {
        console.error('CSV parsing errors:', parseResult.errors);
        // throw new Error(`Failed to parse CSV file: ${filePath}`);
      }

      const csvData = parseResult.data as Record<string, any>[];
      const newExamples: Example[] = [];

      csvData.forEach((row, index) => {
        const exampleOptions: Partial<ExampleOptions> = {};
        // Need a way to handle the 'example' boolean column if it's not in ExampleOptions
        let isExampleRow = true; // Assume true unless 'example' column says otherwise
        const exampleColumnCsvHeader = headerMapping['example']; // Assuming 'example' key exists in mapping for the boolean

        for (const csvHeader in row) {
          const exampleKey = csvHeaderToExampleKeyMap[csvHeader];
          if (!exampleKey) continue;

          let value = row[csvHeader];

          if (value === null || value === undefined || value === '') {
            value = exampleKey === 'additionalMetadata' ? {} : null;
          } else {
            value = String(value);

            if (LIST_LIKE_KEYS.includes(exampleKey)) {
              value = (value as string)
                .split(secondaryDelimiter)
                .map((item) => item.trim())
                .filter((item) => item !== '');
            } else if (exampleKey === 'additionalMetadata') {
              try {
                value = JSON.parse(value as string);
              } catch (e) {
                console.warn(
                  `Row ${index + 2}: Could not parse additionalMetadata "${value}" as JSON. Storing as string.`,
                );
              }
            } else if (exampleColumnCsvHeader && csvHeader === exampleColumnCsvHeader) {
               // Check if current CSV header matches the one mapped to the 'example' concept
               const lowerVal = (value as string).toLowerCase();
               isExampleRow = !['false', '0', 'no', ''].includes(lowerVal);
               // We don't store this boolean directly on ExampleOptions unless it has an 'example' field
               continue; // Don't assign this value to exampleOptions map
             } else if (exampleKey === 'example') {
               // Check key directly
               const lowerVal = (value as string).toLowerCase();
               isExampleRow = !['false', '0', 'no', ''].includes(lowerVal);
               // Assign to options IF the key exists in headerMapping
               if (headerMapping.example) {
                   (exampleOptions as any)[exampleKey] = isExampleRow; 
               }
               // Don't continue here, let assignment happen below
             } else if (exampleKey === 'actualOutput' || exampleKey === 'expectedOutput') {
                // If it contains the delimiter, treat as array, otherwise string
                if ((value as string).includes(secondaryDelimiter)) {
                    value = (value as string)
                      .split(secondaryDelimiter)
                      .map((item) => item.trim())
                      .filter((item) => item !== '');
                } // else leave as string
             }
          }
          (exampleOptions as any)[exampleKey] = value; // Assign using the camelCase key
        }

        // Only add if it's marked as an example and has required fields
        if (isExampleRow) {
           // Check required fields using camelCase
          if (
            exampleOptions.input === undefined ||
            exampleOptions.input === null
            // actualOutput is optional in ExampleOptions, so don't check here
          ) {
            console.warn(
              `Row ${index + 2}: Skipping example due to missing 'input'.`,
            );
          } else {
            // Add trace_id if missing and mapped
            if (headerMapping.traceId && !exampleOptions.traceId) {
                exampleOptions.traceId = String(row[headerMapping.traceId] ?? null); // Ensure it's a string
            }
            newExamples.push(new Example(exampleOptions as ExampleOptions));
          }
        }
      });

      console.info(`Adding ${newExamples.length} examples from CSV`);
      newExamples.forEach((e) => this.addExample(e));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`CSV file not found: ${filePath}`);
        throw new Error(`The file ${filePath} was not found.`);
      } else {
        console.error(`Error loading dataset from CSV: ${filePath}`, error);
        throw error; // Re-throw other errors
      }
    }
  }

  /**
   * Saves the dataset as a file.
   * @param fileType The file type to save as ('json', 'csv', 'yaml').
   * @param dirPath The directory path to save the file to.
   * @param saveName Optional: The name of the file (without extension). Defaults to a timestamp.
   * @param secondaryDelimiter Optional: The delimiter used for joining list fields in CSV output. Defaults to ";".
   */
  public saveAs(
    fileType: SaveFileType,
    dirPath: string,
    saveName?: string,
    secondaryDelimiter: string = ';',
  ): void {
    if (!ACCEPTABLE_FILE_TYPES.includes(fileType)) {
      throw new TypeError(
        `Invalid file type: ${fileType}. Please choose from ${ACCEPTABLE_FILE_TYPES.join(', ')}`,
      );
    }

    try {
      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const fileName = saveName ?? format(new Date(), 'yyyyMMdd_HHmmss');
      const completePath = path.join(dirPath, `${fileName}.${fileType}`);
      // Use the Example class's toJSON method which outputs snake_case keys
      const examplesForOutput = this.examples.map(e => e.toJSON());

      console.info(`Saving dataset to ${completePath}`);

      if (fileType === 'json') {
        const jsonContent = JSON.stringify({ examples: examplesForOutput }, null, 4);
        fs.writeFileSync(completePath, jsonContent, 'utf-8');
      } else if (fileType === 'yaml') {
         // The toJSON output is already structured correctly for YAML
        const yamlContent = YAML.dump({ examples: examplesForOutput }, { noRefs: true, lineWidth: -1 });
        fs.writeFileSync(completePath, yamlContent, 'utf-8');
      } else if (fileType === 'csv') {
        // Define CSV headers using the snake_case keys expected in the output
        const csvHeaders: string[] = [
          'input',
          'actual_output',
          'expected_output',
          'context',
          'retrieval_context',
          'additional_metadata',
          'tools_called',
          'expected_tools',
          'name',
          'example_id',
          'example_index',
          'timestamp',
          'trace_id',
          'example',
        ];

        // Prepare data for PapaParse using the snake_case keys from toJSON()
         const csvData = examplesForOutput.map((e_json) => {
            const row: Record<string, string | boolean | number | null> = {};
            csvHeaders.forEach((header) => {
                const value = e_json[header];
                 // Check original camelCase list keys for joining arrays
                 if ( (
                        header === 'context' ||
                        header === 'retrieval_context' ||
                        header === 'tools_called' ||
                        header === 'expected_tools'
                      ) && Array.isArray(value)
                    ) {
                   row[header] = value.join(secondaryDelimiter);
                 } else if (header === 'additional_metadata' && typeof value === 'object' && value !== null) {
                   try {
                      row[header] = JSON.stringify(value);
                   } catch {
                      row[header] = String(value);
                   }
                 } else if (header === 'example') {
                     row[header] = value ?? true; // Default to true if null/undefined
                 } else {
                   row[header] = value === undefined ? null : value;
                 }
            });
           return row;
          });

        const csvContent = Papa.unparse(csvData, {
          columns: csvHeaders,
          header: true,
          delimiter: ',',
        });
        fs.writeFileSync(completePath, csvContent, 'utf-8');
      }
    } catch (error: any) {
      console.error(`Error saving dataset to ${fileType}:`, error);
      throw error; // Re-throw error
    }
  }
} 