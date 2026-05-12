/**
 * Fixed schema for Block Complexity Factors
 * This is the canonical list of all block complexity factors.
 * Factor names and descriptions are non-editable.
 * Only enabled status and multiplier percentage can be configured.
 */

export interface BlockComplexityFactorSchema {
  id: string;
  name: string;
  description: string;
  defaultMultiplier: number;
  autoApplied: boolean;
  mutuallyExclusiveWith?: string; // ID of mutually exclusive factor
}

export const BLOCK_COMPLEXITY_FACTOR_SCHEMA: BlockComplexityFactorSchema[] = [
  {
    id: 'constraints_development',
    name: 'Constraints Development',
    description: 'From scratch or basic only',
    defaultMultiplier: 10,
    autoApplied: false
  },
  {
    id: 'synthesis_complexity',
    name: 'Synthesis',
    description: 'Yes / No',
    defaultMultiplier: 5,
    autoApplied: false
  },
  {
    id: 'new_design',
    name: 'New Design',
    description: 'No previous tape-out',
    defaultMultiplier: 20,
    autoApplied: false
  },
  {
    id: 'low_power_non_nested',
    name: 'Low Power – Non-nested',
    description: 'Single-level power domains',
    defaultMultiplier: 10,
    autoApplied: false,
    mutuallyExclusiveWith: 'low_power_nested'
  },
  {
    id: 'low_power_nested',
    name: 'Low Power – Nested',
    description: 'Multi-level power domains (mutually exclusive with non-nested)',
    defaultMultiplier: 30,
    autoApplied: false,
    mutuallyExclusiveWith: 'low_power_non_nested'
  },
  {
    id: 'physical_blocks',
    name: 'Any analog IPs',
    description: 'Analog / mixed-signal blocks',
    defaultMultiplier: 30,
    autoApplied: false
  },
  {
    id: 'macro_intensive',
    name: 'macro intensive',
    description: 'High macro density (>100 macros)',
    defaultMultiplier: 10,
    autoApplied: false
  },
  {
    id: 'io_blocks',
    name: 'IO included',
    description: 'Complex IO constraints',
    defaultMultiplier: 20,
    autoApplied: false
  },
  {
    id: 'merged_mode_constraints',
    name: 'Merged mode SDC',
    description: 'Multiple operation modes',
    defaultMultiplier: 10,
    autoApplied: false
  },
  {
    id: 'dft_block_level',
    name: 'DFT Ownership',
    description: 'Per-block DFT',
    defaultMultiplier: 60,
    autoApplied: false
  }
];

/**
 * Get factor schema by ID
 */
export function getFactorSchema(factorId: string): BlockComplexityFactorSchema | undefined {
  return BLOCK_COMPLEXITY_FACTOR_SCHEMA.find(f => f.id === factorId);
}

/**
 * Get all factor IDs
 */
export function getAllFactorIds(): string[] {
  return BLOCK_COMPLEXITY_FACTOR_SCHEMA.map(f => f.id);
}

