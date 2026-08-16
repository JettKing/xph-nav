/**
 * XPH Resource Import Contract
 * Single source of truth for frontend/API field names, stages, errors and AI permissions.
 */
export const XPH_RESOURCE_CONTRACT = Object.freeze({
  version: '5.3-core-contract-1',
  candidatePolicy: Object.freeze({ maxAttempts: 5, candidatesPerAttempt: 1, maxCandidates: 5, selectorCanModify: false, programValidatesCandidates: true }),
  stages: Object.freeze(['reading_source','understanding_content','generating_candidates','validating_candidates','selecting_candidate','finalizing','completed','error']),
  errors: Object.freeze({
    INVALID_REQUEST:'INVALID_REQUEST', MISSING_SOURCE:'MISSING_SOURCE', MISSING_TAXONOMY:'MISSING_TAXONOMY',
    SOURCE_READ_FAILED:'SOURCE_READ_FAILED', CLASSIFICATION_FAILED:'CLASSIFICATION_FAILED', AI_SEMANTIC_FAILED:'AI_SEMANTIC_FAILED',
    CANDIDATE_GENERATION_FAILED:'CANDIDATE_GENERATION_FAILED', NO_VALID_CANDIDATE:'NO_VALID_CANDIDATE',
    INVALID_SELECTION:'INVALID_SELECTION', FINAL_VALIDATION_FAILED:'FINAL_VALIDATION_FAILED', INTERNAL_ERROR:'INTERNAL_ERROR', AI_NOT_CONFIGURED:'AI_NOT_CONFIGURED'
  }),
  requestFields: Object.freeze(['name','website','github','seoTitle','seoDescription','githubName','content','manualDescription','taxonomy','iconMap']),
  responseFields: Object.freeze(['ok','status','stage','data','error']),
  statuses: Object.freeze(['completed','error']),
  aiDecision: Object.freeze({ semantic:['core','facts','category','subcategory'], generation:['candidate'], selection:['selectedIndex'] }),
  resourceSchema: Object.freeze({
    '$schema':'https://json-schema.org/draft/2020-12/schema',
    type:'object',
    additionalProperties:false,
    required:['id','name','description','icon','thumbnail','category','subcategory','website','github','capabilities','scenarios','attributes','audience','official','recommend','status'],
    properties:{
      id:{type:'string'}, name:{type:'string'}, description:{type:'string',minLength:16,maxLength:16}, icon:{type:'string',minLength:1}, thumbnail:{type:'string'},
      category:{type:'string'}, subcategory:{type:'string'}, website:{type:'string'}, github:{type:'string'},
      capabilities:{type:'array',items:{type:'string'}}, scenarios:{type:'array',items:{type:'string'}},
      attributes:{type:'object',required:['pricing','platform','language','audience'],additionalProperties:false,properties:{pricing:{type:'string'},platform:{type:'array',items:{type:'string'}},language:{type:'array',items:{type:'string'}},audience:{type:'array',items:{type:'string'}}}},
      audience:{type:'string'}, official:{type:'boolean'}, recommend:{type:'boolean'}, status:{type:'string'}, features:{type:'array',items:{}} 
    }
  })
});

if (typeof globalThis !== 'undefined') globalThis.XPH_RESOURCE_CONTRACT = XPH_RESOURCE_CONTRACT;