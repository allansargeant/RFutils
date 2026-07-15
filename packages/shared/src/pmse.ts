/**
 * Ofcom PMSE licence types, ported from pmse-to-wwb's parser.py dataclasses.
 * A licence schedule PDF parses into a `ParsedLicence` of `Assignment`s,
 * each of which is one licensed frequency.
 */

export interface Assignment {
  equipmentType: string;
  model: string;
  frequencyMhz: number;
  bandwidth: string;
  maxPower: string;
  emissionClass: string;
  ngrTransmit: string;
  site: string;
  restrictions: string;
  periodStart: string;
  periodEnd: string;
  feeCategory: string;
  feeType: string;
  feeAmount: string;
  /** Filled in after parsing by suggestedNames(). */
  suggestedName?: string;
}

export interface ParsedLicence {
  licenceNo: string;
  noticeOfVariationNo: string;
  licensee: string;
  licenseeAddress: string;
  licenceStart: string;
  licenceEnd: string;
  pmseRef: string;
  licenseeRef: string;
  totalAssignments: number;
  assignments: Assignment[];
  warnings: string[];
}

/** The /api/pmse/convert response — mirrors pmse-to-wwb's convert output. */
export interface PmseConversion {
  metadata: {
    licenceNo: string;
    noticeOfVariationNo: string;
    licensee: string;
    licenseeAddress: string;
    licenceStart: string;
    licenceEnd: string;
    pmseRef: string;
    licenseeRef: string;
    totalAssignments: number;
  };
  warnings: string[];
  assignmentCount: number;
  assignments: Array<
    Pick<Assignment, 'frequencyMhz' | 'equipmentType' | 'model' | 'feeCategory' | 'site' | 'suggestedName'>
  >;
  wwbFrequencyList: string;
  referenceCsv: string;
  wwbShowFile: string;
}

export function emptyLicence(): ParsedLicence {
  return {
    licenceNo: '',
    noticeOfVariationNo: '',
    licensee: '',
    licenseeAddress: '',
    licenceStart: '',
    licenceEnd: '',
    pmseRef: '',
    licenseeRef: '',
    totalAssignments: 0,
    assignments: [],
    warnings: [],
  };
}
