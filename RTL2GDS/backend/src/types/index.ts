export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
}

export interface ProjectTimeline {
  id: string;
  name: string;
  rtl_drop_count: 1 | 2 | 3; // REQUIRED for logic
  months: number;
  notes: string;
}

export interface BlockGateCount {
  baseGateCount: number; // Base gate count in millions (default: 1.5)
  baseResource: number; // Base resource effort (default: 0.5)
  gateIncrementStep: number; // Gate increment step in millions (default: 1.0)
  additionalResourcePercentage: number; // Additional resource percentage per increment (default: 10)
  maxGateCount: number; // Maximum gate count in millions (default: 4.5)
}

export interface BlockComplexityFactorLevel {
  id: string;
  label: string;
  resourcePercentage: number;
  notes?: string;
}

export interface BlockComplexityFactor {
  id: string;
  name: string;
  resourcePercentage: number; // Multiplier percentage for this factor
  notes: string;
  enabled: boolean; // Whether this factor is enabled/available
  autoApplied?: boolean; // If true, factor is auto-applied (e.g., Technology Node)
  levels?: BlockComplexityFactorLevel[]; // Optional: if present, this factor has multiple levels
}

export interface FullChipFactor {
  id: string;
  name: string;
  resources: number;
  notes: string;
}

export interface FullChipPercentageFactorLevel {
  id: string;
  label: string;
  resourcePercentage: number;
  notes?: string;
  locked?: boolean; // If true, admin cannot edit this level's percentage
}

export interface FullChipPercentageFactor {
  id: string;
  name: string;
  resourcePercentage: number; // Default/fallback percentage if no levels
  notes: string;
  enabled?: boolean; // Whether this factor is enabled/available
  autoApplied?: boolean; // If true, factor is auto-applied (e.g., Blocks Scaling)
  levels?: FullChipPercentageFactorLevel[]; // Optional: if present, this factor has multiple levels
}

export interface DFTFactor {
  id: string;
  name: string;
  resources: number; // Only for CAD/Flow (fixed resources)
  notes: string;
}

export interface DftContextPercentages {
  dftAlone: number; // DFT alone percentage (default: 60)
  dftWithIoOrAnalog: number; // DFT with IO OR Analog percentage (default: 70)
  dftWithIoAndAnalog: number; // DFT with IO AND Analog percentage (default: 80)
}

export interface Configuration {
  blockTimeline: ProjectTimeline[]; // Separate timeline for blocks
  fullChipTimeline: ProjectTimeline[]; // Separate timeline for full chip
  blockGateCount: BlockGateCount;
  blockComplexity: BlockComplexityFactor[];
  fullChip: {
    fixed: FullChipFactor[];
    percentage: FullChipPercentageFactor[];
  };
  dft: {
    cadFlow: DFTFactor; // Only CAD/Flow remains as fixed resources
  };
  dftContextPercentages?: DftContextPercentages; // Context-based DFT percentages (configurable by admin)
  costPerResourcePerMonth: number;
  technologyNodeMultipliers: Record<string, number>; // e.g., { "2nm": 0.15, "7nm": 0.09, ... }
}

export interface BlockConfiguration {
  blockName?: string;
  gateCount: number;
  complexityFactors: string[]; // For simple checkbox factors
  complexityFactorLevels: Record<string, string>; // For factors with levels: { factorId: levelId }
  dft: boolean;
  additionalFactors?: Record<string, string>; // DEPRECATED: Not used in calculations
  rtl_drop_count: 1 | 2 | 3; // RTL drop count (1, 2, or 3)
}

export interface FullChipConfiguration {
  enabled: boolean;
  factors: string[];
  percentageFactors: string[]; // For simple checkbox factors
  percentageFactorLevels: Record<string, string>; // For factors with levels: { factorId: levelId }
  dft: boolean;
  cadFlow: boolean;
  rtl_drop_count: 1 | 2 | 3; // RTL drop count (1, 2, or 3)
  fullChipBlocksTier?: 'lt9' | '9to18' | 'gt18'; // Blocks count tier for Full-Chip: <9, 9-18, or 18+
  designMaturity?: 'new_design' | 'revision' | null; // Design maturity for Full Chip / Flat Implementation
  powerDomains?: 'none' | 'non_nested' | 'nested' | null; // Power domains for Full Chip / Flat Implementation
  glueLogic?: boolean; // Glue Logic enabled/disabled
  instanceCount?: number; // Instance count for Glue Logic scaling (<1.5, <2.5, <3.5, <4.5)
  numberOfBlocks?: number; // Number of blocks in the full chip (for full-chip only mode)
}

export interface ProjectConfiguration {
  projectName: string;
  customerName?: string; // Optional - not stored in database (user info comes from JWT token)
  emailId?: string; // Optional - not stored in database (user info comes from JWT token)
  technology: string;
  fullChip: FullChipConfiguration;
  blocks: BlockConfiguration[];
  additionalFactors?: Record<string, string>; // DEPRECATED: Not used in calculations
  isFlat?: boolean; // Flag for Flat implementation (vs hierarchical)
}

