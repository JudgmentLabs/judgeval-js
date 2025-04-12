// Export data models
export { Example, ExampleBuilder, ExampleOptions } from './data/example.js';
export { ScoringResult, ScoringResultBuilder, ScorerData, ScoringResultOptions } from './data/result.js';

// Export common utilities (like Tracer)
export { Tracer, SpanType, wrap, TraceClient } from './common/tracer.js';

// Export scorers
export { 
  Scorer, 
  APIJudgmentScorer, 
  JudgevalScorer, 
  ScorerWrapper 
} from './scorers/base-scorer.js';

export {
  AnswerCorrectnessScorer,
  AnswerRelevancyScorer,
  ComparisonScorer,
  ContextualPrecisionScorer,
  ContextualRecallScorer,
  ContextualRelevancyScorer,
  ExecutionOrderScorer,
  FaithfulnessScorer,
  GroundednessScorer,
  HallucinationScorer,
  InstructionAdherenceScorer,
  JsonCorrectnessScorer,
  SummarizationScorer
} from './scorers/api-scorer.js';

export { ExactMatchScorer } from './scorers/exact-match-scorer.js';

// Export rules system
export {
  AlertStatus,
  Condition,
  NotificationConfig,
  Rule,
  AlertResult,
  RulesEngine
} from './rules.js';

// Export evaluation components
export { EvaluationRun, EvaluationRunOptions } from './evaluation-run.js';
export { 
  runEval, 
  assertTest, 
  JudgmentAPIError,
  sendToRabbitMQ,
  executeApiEval,
  mergeResults,
  checkMissingScorerData,
  checkEvalRunNameExists,
  logEvaluationResults,
  checkExamples
} from './run-evaluation.js';

// Export client
export { JudgmentClient } from './judgment-client.js';

// Export constants
export * from './constants.js';

// Export clients
export * from './clients.js';
