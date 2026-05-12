import { Configuration, ProjectConfiguration } from '../types';

/**
 * @deprecated DO NOT USE - This frontend calculator has been deprecated.
 * All cost calculations must use the backend API endpoint: /estimation/calculate
 * The backend EstimationService.calculateCost() is the SINGLE SOURCE OF TRUTH.
 * 
 * This file is kept for reference only but should NOT be imported or used.
 */
export const calculateCost = (
  projectConfig: ProjectConfiguration,
  systemConfig: Configuration
): number => {
  console.error("DEPRECATED: Frontend calculateCost() should NOT be used. Use backend API /estimation/calculate instead.");
  let totalResources = 0;

  // Calculate timeline months - use block timeline for blocks, full chip timeline for full chip
  // Since we don't have a direct timeline property, we'll use the first block's rtl_drop_count
  // or default to block timeline
  const rtlDropCount = projectConfig.blocks[0]?.rtl_drop_count || 1;
  const timeline = systemConfig.blockTimeline.find((t: { rtl_drop_count: number }) => t.rtl_drop_count === rtlDropCount);
  const months = timeline?.months || 0;

  // Calculate block resources
  projectConfig.blocks.forEach(block => {
    let blockResources = systemConfig.blockGateCount.baseResource;

    // Gate count scaling
    const additionalGates = Math.max(0, block.gateCount - systemConfig.blockGateCount.baseGateCount);
    const additionalMillions = additionalGates / systemConfig.blockGateCount.gateIncrementStep;
    const gateCountMultiplier = 1 + (additionalMillions * systemConfig.blockGateCount.additionalResourcePercentage / 100);

    blockResources *= gateCountMultiplier;

    // Complexity factors
    block.complexityFactors.forEach(factorId => {
      const factor = systemConfig.blockComplexity.find(f => f.id === factorId);
      if (factor) {
        blockResources *= (1 + factor.resourcePercentage / 100);
      }
    });

    // Block-level DFT - Note: DFT block level resources don't exist in current schema
    // Only CAD/Flow exists, which is handled at full chip level
    // This is a placeholder for deprecated code
    if (block.dft) {
      // No block-level DFT resources in current schema
      // blockResources += 0;
    }

    // Additional factors for blocks
    if (block.additionalFactors) {
      Object.entries(block.additionalFactors).forEach(([factorId, levelId]) => {
        const factor = systemConfig.additionalFactors.find(f => f.id === factorId);
        if (factor) {
          const level = factor.levels.find(l => l.id === levelId);
          if (level) {
            blockResources *= (1 + level.percentage / 100);
          }
        }
      });
    }

    totalResources += blockResources;
  });

  // Calculate full chip resources
  if (projectConfig.fullChip.enabled) {
    let fullChipResources = 0;

    // Fixed full chip factors
    projectConfig.fullChip.factors.forEach(factorId => {
      const factor = systemConfig.fullChip.fixed.find(f => f.id === factorId);
      if (factor) {
        fullChipResources += factor.resources;
      }
    });

    // Percentage-based full chip factors (applied to base full chip resources)
    const baseFullChipResources = fullChipResources;
    projectConfig.fullChip.percentageFactors.forEach(factorId => {
      const factor = systemConfig.fullChip.percentage.find(f => f.id === factorId);
      if (factor) {
        fullChipResources += baseFullChipResources * (factor.resourcePercentage / 100);
      }
    });

    // Full chip DFT - Note: topLevel doesn't exist, only cadFlow exists
    // This is a placeholder for deprecated code
    if (projectConfig.fullChip.dft) {
      // No top-level DFT resources in current schema
      // fullChipResources += 0;
    }

    // DFT CAD/Flow
    if (projectConfig.fullChip.cadFlow) {
      fullChipResources += systemConfig.dft.cadFlow.resources;
    }

    totalResources += fullChipResources;
  }

  // Project-level additional factors
  if (projectConfig.additionalFactors) {
    Object.entries(projectConfig.additionalFactors).forEach(([factorId, levelId]) => {
      const factor = systemConfig.additionalFactors.find(f => f.id === factorId);
      if (factor) {
        const level = factor.levels.find(l => l.id === levelId);
        if (level) {
          totalResources *= (1 + level.percentage / 100);
        }
      }
    });
  }

  // Calculate total cost: resources × months × cost per resource per month
  const totalCost = totalResources * months * systemConfig.costPerResourcePerMonth;

  return Math.round(totalCost);
};

