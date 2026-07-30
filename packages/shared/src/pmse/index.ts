/**
 * PMSE licence → WWB pipeline. Ties the PDF parser, exporters and .shw
 * generator together, mirroring pmse-to-wwb's /api/convert response.
 */

import type { ParsedLicence, PmseConversion } from '../index.js';
import { parseLicencePdf } from './pdfParser.js';
import { suggestedNames, toReferenceCsv, toWwbFrequencyList } from './exporters.js';
import { generateShow } from './showGenerator.js';

export { parseLicencePdf, generateShow, suggestedNames, toReferenceCsv, toWwbFrequencyList };
export type { PmseConversion };

export async function convertLicence(data: Uint8Array): Promise<PmseConversion> {
  const result: ParsedLicence = await parseLicencePdf(data);

  const names = suggestedNames(result.assignments);
  result.assignments.forEach((a, i) => {
    a.suggestedName = names[i];
  });

  return {
    metadata: {
      licenceNo: result.licenceNo,
      noticeOfVariationNo: result.noticeOfVariationNo,
      licensee: result.licensee,
      licenseeAddress: result.licenseeAddress,
      licenceStart: result.licenceStart,
      licenceEnd: result.licenceEnd,
      pmseRef: result.pmseRef,
      licenseeRef: result.licenseeRef,
      totalAssignments: result.totalAssignments,
    },
    warnings: result.warnings,
    assignmentCount: result.assignments.length,
    assignments: result.assignments.map((a) => ({
      frequencyMhz: a.frequencyMhz,
      equipmentType: a.equipmentType,
      model: a.model,
      feeCategory: a.feeCategory,
      site: a.site,
      suggestedName: a.suggestedName,
    })),
    wwbFrequencyList: toWwbFrequencyList(result.assignments),
    referenceCsv: toReferenceCsv(result.assignments),
    wwbShowFile: generateShow(result.assignments, {
      showName: result.licenceNo ? `Licence ${result.licenceNo}` : 'PMSE Import',
      customer: result.licensee,
      venueName: result.assignments[0]?.site ?? '',
    }),
  };
}
