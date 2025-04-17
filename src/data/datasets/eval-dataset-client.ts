import { Example, ExampleOptions } from '../example.js'; // Use Example class
import { EvalDataset } from './eval-dataset.js';
import axios, { AxiosError, AxiosResponse } from 'axios'; // Use axios
import cliProgress from 'cli-progress'; // Use cli-progress
import colors from 'ansi-colors'; // For colored progress bar text
import logger from '../../common/logger-instance.js'; // Adjust path as needed

// Import constants (assuming they are correctly defined in constants.ts)
import {
  JUDGMENT_DATASETS_PUSH_API_URL,
  JUDGMENT_DATASETS_APPEND_API_URL,
  JUDGMENT_DATASETS_PULL_API_URL,
  JUDGMENT_DATASETS_DELETE_API_URL,
  JUDGMENT_DATASETS_PROJECT_STATS_API_URL,
  JUDGMENT_DATASETS_INSERT_API_URL,
  JUDGMENT_DATASETS_EXPORT_JSONL_API_URL
} from '../../constants.js'; // Adjust path as needed

export class EvalDatasetClient {
  private judgmentApiKey: string;
  private organizationId: string;

  constructor(judgmentApiKey: string, organizationId: string) {
    if (!judgmentApiKey) throw new Error('Judgment API Key is required for EvalDatasetClient.');
    if (!organizationId) throw new Error('Organization ID is required for EvalDatasetClient.');
    this.judgmentApiKey = judgmentApiKey;
    this.organizationId = organizationId;
     // Optional: Log initialization if desired
     logger.info('Initialized EvalDatasetClient.');
  }

  public createDataset(examples: Example[] = []): EvalDataset {
    return new EvalDataset(examples);
  }

  /**
   * Pushes the dataset to the Judgment platform.
   * @returns True if successful, false otherwise.
   */
  public async pushDataset(
    dataset: EvalDataset,
    alias: string,
    projectName: string,
    overwrite: boolean = false
  ): Promise<boolean> {
    logger.debug(
      `Pushing dataset with alias '${alias}' for project '${projectName}' (overwrite=${overwrite})`,
    );
    if (overwrite) {
      logger.warn(`Overwrite enabled for dataset alias '${alias}' in project '${projectName}'`);
    }

    const progressBar = new cliProgress.SingleBar({
      format: `Pushing ${colors.magenta(alias)} to Judgment... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { status: 'Starting...' });

    const content = {
      dataset_alias: alias,
      project_name: projectName,
      examples: dataset.examples.map((e: Example) => e.toJSON()),
      overwrite: overwrite,
    };

    try {
      progressBar.update(30, { status: 'Sending request...' });
      const response = await axios.post(
        JUDGMENT_DATASETS_PUSH_API_URL,
        content,
        {
          headers: this.getAuthHeaders(),
        },
      );
      progressBar.update(80, { status: 'Processing response...' });

      if (response.status >= 200 && response.status < 300) {
        const payload = response.data;
        dataset.alias = payload?._alias ?? alias;
        dataset.id = payload?._id;
        logger.info(`Successfully pushed dataset with alias '${alias}' to project '${projectName}'`);
        progressBar.update(100, { status: colors.green('Done!') });
        return true;
      } else {
        logger.error(
          `Server error during push dataset: ${response.status} ${response.statusText}`,
        );
        progressBar.stop();
        return false;
      }
    } catch (error) {
      this.handleApiError(error, 'pushDataset');
      progressBar.stop();
      return false;
    }
  }

  /**
   * Pulls the dataset from the Judgment platform.
   */
  public async pullDataset(
    alias: string,
    projectName: string
  ): Promise<EvalDataset> {
    logger.debug(`Pulling dataset with alias '${alias}' from project '${projectName}'`);
    const dataset = this.createDataset(); // Use own createDataset

    const progressBar = new cliProgress.SingleBar({
      format: `Pulling ${colors.magenta(alias)} from Judgment... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { status: 'Starting...' });

    const requestBody = {
      dataset_alias: alias,
      project_name: projectName
    };

    try {
      progressBar.update(30, { status: 'Sending request...' });
      const response = await axios.post(
        JUDGMENT_DATASETS_PULL_API_URL,
        requestBody,
        {
          headers: this.getAuthHeaders()
        }
      );
      progressBar.update(80, { status: 'Processing response...' });

      if (response.status >= 200 && response.status < 300) {
        const payload = response.data;
        const examplesFromApi = payload?.examples ?? [];

        // Map API response (assuming snake_case based on Python) to ExampleOptions
        dataset.examples = examplesFromApi.map((e_api: any) => {
             const options: ExampleOptions = {
                 input: e_api.input,
                 actualOutput: e_api.actual_output,
                 expectedOutput: e_api.expected_output,
                 context: e_api.context,
                 retrievalContext: e_api.retrieval_context,
                 additionalMetadata: e_api.additional_metadata,
                 toolsCalled: e_api.tools_called,
                 expectedTools: e_api.expected_tools,
                 exampleId: e_api.example_id,
                 exampleIndex: e_api.example_index,
                 timestamp: e_api.timestamp,
                 example: e_api.example,
             };
             return new Example(options);
         });

        dataset.alias = payload?.alias ?? alias;
        dataset.id = payload?.id;

        logger.info(`Successfully pulled dataset with alias '${alias}' from project '${projectName}'`);
        progressBar.update(100, { status: colors.green('Done!') });
        return dataset;
      } else {
        logger.error(
          `Server error during pull dataset: ${response.status} ${response.statusText}`,
        );
        progressBar.stop();
        throw new Error(`Failed to pull dataset '${alias}': ${response.statusText}`);
      }
    } catch (error) {
      this.handleApiError(error, 'pullDataset');
      progressBar.stop();
      throw error;
    }
  }

  /**
   * Deletes the dataset from the Judgment platform.
   * @returns True if successful, false otherwise.
   */
  public async deleteDataset(
    alias: string,
    projectName: string
  ): Promise<boolean> {
    logger.debug(`Deleting dataset with alias '${alias}' from project '${projectName}'`);

    const progressBar = new cliProgress.SingleBar({
      format: `Deleting ${colors.magenta(alias)} from Judgment... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { status: 'Starting...' });

    const requestBody = {
      dataset_alias: alias,
      project_name: projectName
    };

    try {
      progressBar.update(30, { status: 'Sending request...' });
      await axios.post(JUDGMENT_DATASETS_DELETE_API_URL, requestBody, {
        headers: this.getAuthHeaders()
      });
      progressBar.update(100, { status: colors.green('Done!') });
      logger.info(`Successfully deleted dataset with alias '${alias}' from project '${projectName}'`);
      return true;
    } catch (error) {
      this.handleApiError(error, 'deleteDataset');
      progressBar.stop();
      return false;
    }
  }

  /**
   * Pulls dataset statistics for a project from the Judgment platform.
   */
  public async pullProjectDatasetStats(
    projectName: string
  ): Promise<Record<string, any>> {
     logger.debug(`Pulling project dataset stats for project '${projectName}'`);

    const progressBar = new cliProgress.SingleBar({
      format: `Pulling project stats for ${colors.magenta(projectName)}... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { status: 'Starting...' });

    const requestBody = {
      project_name: projectName
    };

    try {
      progressBar.update(30, { status: 'Sending request...' });
      const response = await axios.post(
        JUDGMENT_DATASETS_PROJECT_STATS_API_URL,
        requestBody,
        {
          headers: this.getAuthHeaders()
        }
      );
      progressBar.update(80, { status: 'Processing response...' });

      if (response.status >= 200 && response.status < 300) {
        logger.info(
          `Successfully pulled project stats for '${projectName}'`,
        );
        progressBar.update(100, { status: colors.green('Done!') });
        return response.data;
      } else {
        logger.error(
          `Server error pulling project stats: ${response.status} ${response.statusText}`,
        );
        progressBar.stop();
        throw new Error(`Failed to pull project stats for '${projectName}': ${response.statusText}`);
      }
    } catch (error) {
      this.handleApiError(error, 'pullProjectDatasetStats');
      progressBar.stop();
      throw error;
    }
  }

  /**
   * Inserts new examples into an existing dataset on the Judgment platform.
   * @returns True if successful, false otherwise.
   */
  public async insertDataset(
    alias: string,
    examples: Example[],
    projectName: string
  ): Promise<boolean> {
     logger.debug(`Inserting ${examples.length} examples into dataset '${alias}' for project '${projectName}'`);

    const progressBar = new cliProgress.SingleBar({
      format: `Inserting examples into ${colors.magenta(alias)}... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { status: 'Starting...' });

    const content = {
      dataset_alias: alias,
      examples: examples.map((e) => e.toJSON()),
      project_name: projectName
    };

    try {
      progressBar.update(30, { status: 'Sending request...' });
      await axios.post(JUDGMENT_DATASETS_INSERT_API_URL, content, {
        headers: this.getAuthHeaders()
      });
      progressBar.update(100, { status: colors.green('Done!') });
      logger.info(`Successfully inserted examples into dataset '${alias}' in project '${projectName}'`);
      return true;
    } catch (error) {
      this.handleApiError(error, 'insertDataset');
      progressBar.stop();
      return false;
    }
  }

  /**
   * Exports a dataset in JSONL format from the Judgment platform.
   * @returns AxiosResponse containing the stream if successful.
   */
  public async exportJsonl(
    alias: string,
    projectName: string,
  ): Promise<AxiosResponse> {
     logger.debug(`Exporting dataset '${alias}' from project '${projectName}' as JSONL`);

    const progressBar = new cliProgress.SingleBar({
        format: `Exporting ${colors.magenta(alias)} as JSONL... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        clearOnComplete: false,
        stopOnComplete: true,
      }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { status: 'Starting...' });

    const requestBody = {
      dataset_alias: alias,
      project_name: projectName,
    };

    try {
      progressBar.update(30, { status: 'Sending request...' });
      const response = await axios.post(
        JUDGMENT_DATASETS_EXPORT_JSONL_API_URL,
        requestBody,
        {
          headers: this.getAuthHeaders(),
          responseType: 'stream',
        },
      );
      progressBar.update(100, { status: colors.green('Done!') });
      logger.info(`Successfully initiated export for dataset '${alias}' from project '${projectName}'`);
      return response;
    } catch (error) {
      this.handleApiError(error, 'exportJsonl');
      progressBar.stop();
      throw error;
    }
  }

  /**
   * Appends examples to an existing dataset on the Judgment platform.
   * @returns True if successful, false otherwise.
   */
  public async append(
    alias: string,
    examples: Example[],
    projectName: string
  ): Promise<boolean> {
    logger.debug(`Appending ${examples.length} examples to dataset '${alias}' for project '${projectName}'`);

    const progressBar = new cliProgress.SingleBar({
      format: `Appending to ${colors.magenta(alias)}... | ${colors.cyan('{bar}')} | {percentage}% || {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { status: 'Starting...' });

    const content = {
      dataset_alias: alias,
      examples: examples.map((e) => e.toJSON()),
      project_name: projectName
    };

    try {
      progressBar.update(30, { status: 'Sending request...' });
      const response = await axios.post(
        JUDGMENT_DATASETS_APPEND_API_URL,
        content,
        {
          headers: this.getAuthHeaders()
        }
      );
      progressBar.update(80, { status: 'Processing response...' });

      if (response.status >= 200 && response.status < 300) {
          logger.info(`Successfully appended examples to dataset '${alias}' in project '${projectName}'`);
          progressBar.update(100, { status: colors.green('Done!') });
          return true;
      } else {
          logger.error(
              `Server error during append dataset: ${response.status} ${response.statusText}`,
              response.data
          );
          progressBar.stop();
          return false;
      }
    } catch (error) {
      this.handleApiError(error, 'appendDataset');
      progressBar.stop();
      return false;
    }
  }

  // --- Helper Methods ---

  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.judgmentApiKey}`,
      'X-Organization-Id': this.organizationId,
    };
  }

  private handleApiError(error: unknown, context: string): void {
    logger.error(`API Error during ${context}:`);
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const response = axiosError.response;

      if (response) {
        logger.error(`Status: ${response.status} ${response.statusText}`);
        logger.debug('Response Data:', response.data);
        if (response.status === 422) {
          logger.error('Validation Error Detail:', response.data);
        } else if (context === 'exportJsonl' && response.status === 404) {
           logger.error(`Dataset not found.`);
        } else if (context.startsWith('delete') && response.status === 404) {
           logger.warn(`${context}: Resource not found, may have already been deleted.`);
        }
      } else if (axiosError.request) {
        logger.error('No response received from server.'); // Simplified log call
      } else {
        logger.error(`Error setting up API request for ${context}`); // Simplified log call
      }
    } else {
      logger.error(`Unexpected error during ${context}`); // Simplified log call
    }
  }
} 