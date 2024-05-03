/**
 * (c) Copyright Reserved OpenEPCIS 2024. All rights reserved.
 * Use of this material is subject to license.
 * Copying and unauthorised use of this material strictly prohibited.
 */

import Ajv from 'ajv';
const ajv = new Ajv();
import {
  detectDocumentType,
  documentTypes,
  parseExpression,
  expressionExecutor,
  profileDetectionRulesSchema,
  errorMessages,
} from '../index';

const customMatches = (expression, event) => {
  const segments = expression.split(/&&|\|\|/);

  const lodashExpressions = [];
  const nonLodashExpressions = [];

  segments.forEach((segment) => {
    if (!segment.includes('&&') && !segment.includes('||')) {
      if (segment.match(/^\s*!?_\./)) {
        lodashExpressions.push(segment);
      } else {
        nonLodashExpressions.push(segment);
      }
    }
  });

  const processedSegments = segments.map((segment) => {
    if (!segment.includes('&&') && !segment.includes('||')) {
      return expressionExecutor(segment, event);
    }
    return segment;
  });
  return parseExpression(processedSegments.join(' '));
};

const processEventProfiles = (event, profileRules) => {
  const detectedEventProfiles = [];
  for (const rule of profileRules) {
    if (rule.eventType === event.type) {
      const result = customMatches(rule.expression, event);
      detectedEventProfiles.push(result === true ? rule.name : '');
    }
  }
  return detectedEventProfiles.filter(
    (profile, index, self) => profile !== '' && self.indexOf(profile) === index,
  );
};

const detectEpcisDocumentProfiles = (document, profileRules) => {
  return Array.isArray(document.epcisBody.eventList)
    ? document.epcisBody.eventList.map((event) => processEventProfiles(event, profileRules))
    : [];
};

const detectBareEventProfiles = (document, profileRules) => {
  return processEventProfiles(document, profileRules);
};

export const detectAllProfiles = (document = {}, eventProfileDetectionRules = []) => {
  const validate = ajv.compile(profileDetectionRulesSchema);
  const valid = validate(eventProfileDetectionRules);
  const detectedDocumentType = detectDocumentType(document);

  if (
    !document ||
    Object.keys(document).length === 0 ||
    !eventProfileDetectionRules ||
    eventProfileDetectionRules.length === 0
  ) {
    throw new Error(errorMessages.documentOrRulesEmpty);
  }

  if (valid) {
    if (detectedDocumentType === documentTypes.epcisDocument) {
      return detectEpcisDocumentProfiles(document, eventProfileDetectionRules);
    } else if (detectedDocumentType === documentTypes.bareEvent) {
      return detectBareEventProfiles(document, eventProfileDetectionRules);
    } else if (detectedDocumentType === documentTypes.unidentified) {
      throw new Error(errorMessages.invalidEpcisOrBareEvent);
    }
  } else {
    throw new Error(validate.errors[0].message);
  }
  return [];
};
