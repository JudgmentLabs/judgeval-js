/**
 * Rules system for JudgEval that enables alerts based on metric thresholds.
 */
import { v4 as uuidv4 } from 'uuid';
import { Scorer, APIJudgmentScorer, JudgevalScorer, ScorerWrapper } from './scorers/base-scorer';

/**
 * Status of an alert evaluation
 */
export enum AlertStatus {
  TRIGGERED = 'triggered',
  NOT_TRIGGERED = 'not_triggered',
}

/**
 * A single metric condition
 */
export class Condition {
  metric: Scorer;

  constructor(metric: Scorer) {
    this.metric = metric;
  }

  /**
   * Get the name of the metric for lookups in scores dictionary
   */
  get metricName(): string {
    if (this.metric instanceof ScorerWrapper) {
      return this.metric.scoreType || String(this.metric);
    } else if ('scoreType' in this.metric) {
      return this.metric.scoreType;
    } else {
      return String(this.metric);
    }
  }

  /**
   * Get the threshold from the metric
   */
  get threshold(): number {
    return 'threshold' in this.metric ? this.metric.threshold : 0.5;
  }

  /**
   * Evaluate the condition against a value
   * Returns true if the condition passes, false otherwise
   */
  evaluate(value: number): boolean {
    // Store the value in the scorer
    if ('score' in this.metric) {
      this.metric.score = value;
    }

    // Use the scorer's success check function if available
    if ('successCheck' in this.metric) {
      return this.metric.successCheck();
    } else {
      // Fallback to default comparison (greater than or equal)
      return value >= this.threshold;
    }
  }

  /**
   * Convert the condition to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      metric: this.metric.toJSON ? this.metric.toJSON() : this.metric,
    };
  }
}

/**
 * Configuration for notifications when a rule is triggered
 */
export class NotificationConfig {
  enabled: boolean;
  communicationMethods: string[];
  emailAddresses?: string[];
  sendAt?: number;

  constructor(
    enabled: boolean = true,
    communicationMethods: string[] = [],
    emailAddresses?: string[],
    sendAt?: number
  ) {
    this.enabled = enabled;
    this.communicationMethods = communicationMethods;
    this.emailAddresses = emailAddresses;
    this.sendAt = sendAt;
  }

  /**
   * Convert the notification config to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      enabled: this.enabled,
      communication_methods: this.communicationMethods,
      email_addresses: this.emailAddresses,
      send_at: this.sendAt,
    };
  }
}

/**
 * Configuration for a single rule
 */
export class Rule {
  ruleId: string;
  name: string;
  description?: string;
  conditions: Condition[];
  combineType: 'all' | 'any';
  notification?: NotificationConfig;

  constructor(
    name: string,
    conditions: Condition[],
    combineType: 'all' | 'any' = 'all',
    description?: string,
    notification?: NotificationConfig,
    ruleId?: string
  ) {
    this.ruleId = ruleId || uuidv4();
    this.name = name;
    this.description = description;
    this.conditions = conditions;
    this.combineType = combineType;
    this.notification = notification;

    // Validate
    if (!this.conditions || this.conditions.length === 0) {
      throw new Error('Conditions list cannot be empty');
    }
    if (this.combineType !== 'all' && this.combineType !== 'any') {
      throw new Error('Combine type must be "all" or "any"');
    }
  }

  /**
   * Convert the rule to a plain object
   */
  toJSON(): Record<string, any> {
    const data: Record<string, any> = {
      rule_id: this.ruleId,
      name: this.name,
      description: this.description,
      conditions: this.conditions.map(condition => {
        const conditionData: Record<string, any> = {};
        
        // Handle the metric property
        if (condition.metric) {
          const metricObj = condition.metric;
          
          // Create standardized metric representation
          const metricData: Record<string, any> = {
            score_type: '',
            threshold: 0.0
          };
          
          // Try to use object's own serialization methods
          if ('toJSON' in metricObj) {
            const origData = metricObj.toJSON();
            // Copy any existing fields
            Object.assign(metricData, origData);
          }
          
          // Ensure required fields have values
          if (!metricData.score_type && metricData.name) {
            metricData.score_type = metricData.name;
          }
          
          if (!metricData.score_type) {
            // Try to get score_type from different possible attributes
            if ('scoreType' in metricObj) {
              metricData.score_type = (metricObj as any).scoreType;
            } else if ('name' in metricObj) {
              metricData.score_type = (metricObj as any).name;
            } else {
              // Last resort: use string representation
              metricData.score_type = String(metricObj);
            }
          }
          
          // Make sure threshold is set
          if (!metricData.threshold && metricData.threshold !== 0.0) {
            if ('threshold' in metricObj) {
              metricData.threshold = metricObj.threshold;
            } else {
              // Use condition threshold
              metricData.threshold = condition.threshold;
            }
          }
          
          conditionData.metric = metricData;
        }
        
        return conditionData;
      }),
      combine_type: this.combineType,
    };

    if (this.notification) {
      data.notification = this.notification.toJSON();
    }

    return data;
  }
}

/**
 * Result of evaluating a rule
 */
export class AlertResult {
  status: AlertStatus;
  ruleId?: string;
  ruleName: string;
  conditionsResult: Array<{
    metric: string;
    value: number;
    threshold: number;
    passed: boolean;
  }>;
  metadata: Record<string, any>;
  notification?: NotificationConfig;

  constructor(
    status: AlertStatus,
    ruleName: string,
    conditionsResult: Array<{
      metric: string;
      value: number;
      threshold: number;
      passed: boolean;
    }>,
    metadata: Record<string, any> = {},
    ruleId?: string,
    notification?: NotificationConfig
  ) {
    this.status = status;
    this.ruleId = ruleId;
    this.ruleName = ruleName;
    this.conditionsResult = conditionsResult;
    this.metadata = metadata;
    this.notification = notification;
  }

  /**
   * Get example_id from metadata for backward compatibility
   */
  get exampleId(): string | undefined {
    return this.metadata.example_id;
  }

  /**
   * Get timestamp from metadata for backward compatibility
   */
  get timestamp(): string | undefined {
    return this.metadata.timestamp;
  }

  /**
   * Convert the alert result to a plain object
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {
      status: this.status,
      rule_name: this.ruleName,
      conditions_result: this.conditionsResult,
      metadata: this.metadata,
    };

    if (this.ruleId) {
      result.rule_id = this.ruleId;
    }

    if (this.notification) {
      result.notification = this.notification.toJSON();
    }

    return result;
  }
}

/**
 * Engine for creating and evaluating rules against metrics
 */
export class RulesEngine {
  rules: Record<string, Rule>;

  constructor(rules: Record<string, Rule>) {
    this.rules = rules;
  }

  /**
   * Configure notification settings for a specific rule
   */
  configureNotification(
    ruleId: string,
    enabled: boolean = true,
    communicationMethods: string[] = [],
    emailAddresses?: string[],
    sendAt?: number
  ): void {
    if (!this.rules[ruleId]) {
      throw new Error(`Rule with ID ${ruleId} not found`);
    }

    this.rules[ruleId].notification = new NotificationConfig(
      enabled,
      communicationMethods,
      emailAddresses,
      sendAt
    );
  }

  /**
   * Configure notification settings for all rules
   */
  configureAllNotifications(
    enabled: boolean = true,
    communicationMethods: string[] = [],
    emailAddresses?: string[],
    sendAt?: number
  ): void {
    for (const ruleId in this.rules) {
      this.configureNotification(
        ruleId,
        enabled,
        communicationMethods,
        emailAddresses,
        sendAt
      );
    }
  }

  /**
   * Evaluate all rules against a set of scores
   * Returns mapping of rule IDs to their alert results
   */
  evaluateRules(
    scores: Record<string, number>,
    exampleMetadata?: Record<string, any>
  ): Record<string, AlertResult> {
    const results: Record<string, AlertResult> = {};
    const metadata = exampleMetadata || {};
    
    // Add timestamp if not present
    if (!metadata.timestamp) {
      metadata.timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    }

    for (const ruleId in this.rules) {
      const rule = this.rules[ruleId];
      const conditionsResult: Array<{
        metric: string;
        value: number;
        threshold: number;
        passed: boolean;
      }> = [];
      
      let allPassed = true;
      let anyPassed = false;

      // Evaluate each condition
      for (const condition of rule.conditions) {
        const metricName = condition.metricName;
        const value = scores[metricName] || 0;
        const threshold = condition.threshold;
        const passed = condition.evaluate(value);

        conditionsResult.push({
          metric: metricName,
          value,
          threshold,
          passed,
        });

        if (!passed) {
          allPassed = false;
        } else {
          anyPassed = true;
        }
      }

      // Determine if the rule is triggered based on combine type
      const isTriggered = 
        (rule.combineType === 'all' && allPassed) || 
        (rule.combineType === 'any' && anyPassed);

      results[ruleId] = new AlertResult(
        isTriggered ? AlertStatus.TRIGGERED : AlertStatus.NOT_TRIGGERED,
        rule.name,
        conditionsResult,
        metadata,
        rule.ruleId,
        rule.notification
      );
    }

    return results;
  }

  /**
   * Evaluate all rules against multiple examples in parallel
   */
  async evaluateRulesParallel(
    exampleScores: Record<string, Record<string, number>>,
    exampleMetadata: Record<string, Record<string, any>>,
    maxConcurrent: number = 100
  ): Promise<Record<string, Record<string, AlertResult>>> {
    const results: Record<string, Record<string, AlertResult>> = {};
    const exampleIds = Object.keys(exampleScores);
    
    // Process in batches to control concurrency
    for (let i = 0; i < exampleIds.length; i += maxConcurrent) {
      const batch = exampleIds.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(exampleId => {
        const scores = exampleScores[exampleId];
        const metadata = exampleMetadata[exampleId] || {};
        return this.evaluateRules(scores, metadata);
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batch.forEach((exampleId, index) => {
        results[exampleId] = batchResults[index];
      });
    }
    
    return results;
  }
}
