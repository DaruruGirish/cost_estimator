import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ProjectConfiguration, Configuration } from '../types';
import { FlatImplementationService } from './flat-implementation.service';
import { FullChipConfigurationService } from './full-chip-configuration.service';

@Injectable()
export class EstimationService {
  constructor(
    private configService: ConfigService,
    private flatImplementationService: FlatImplementationService,
    private fullChipConfigurationService: FullChipConfigurationService,
  ) { }

  calculateCost(projectConfig: ProjectConfiguration): {
    months: number;
    price: number;
  } {
    // Validate input
    if (!projectConfig) {
      throw new BadRequestException('Project configuration is required');
    }

    // ============================================================
    // FLAT IMPLEMENTATION DETECTION - Route to separate service
    // ============================================================
    // CRITICAL: Flat Implementation has its own calculation logic
    // When isFlat === true, use FlatImplementationService
    // Flat Implementation should have NO blocks - ignore any blocks if present
    if (projectConfig.isFlat === true) {
      console.log('[EstimationService] Detected Flat Implementation - routing to FlatImplementationService');
      if (projectConfig.blocks && projectConfig.blocks.length > 0) {
        console.warn('[EstimationService] WARNING: Flat Implementation detected but blocks are present. Ignoring blocks for Flat Implementation calculation.');
      }
      return this.flatImplementationService.calculateCost(projectConfig);
    }

    // ============================================================
    // FULL CHIP CONFIGURATION DETECTION - Route to separate service
    // ============================================================
    // CRITICAL: Full Chip Configuration has its own calculation logic
    // When isFlat === false && fullChip.enabled === true && blocks.length === 0, use FullChipConfigurationService
    // Full Chip Configuration should have NO blocks - this is the "Full Chip Only" mode
    console.log(`[EstimationService] Checking Full Chip Configuration routing: isFlat=${projectConfig.isFlat}, fullChip.enabled=${projectConfig.fullChip?.enabled}, blocks.length=${projectConfig.blocks?.length || 0}`);
    if (projectConfig.isFlat === false &&
      projectConfig.fullChip?.enabled === true &&
      (!projectConfig.blocks || projectConfig.blocks.length === 0)) {
      console.log('[EstimationService] Detected Full Chip Configuration - routing to FullChipConfigurationService');
      return this.fullChipConfigurationService.calculateCost(projectConfig);
    } else if (projectConfig.isFlat === false && projectConfig.fullChip?.enabled === true && projectConfig.blocks && projectConfig.blocks.length > 0) {
      console.log(`[EstimationService] Full Chip enabled but blocks present (${projectConfig.blocks.length} blocks) - routing to Block + Full Chip Integration mode`);
    }

    console.log("[EstimationService] Using main calculation logic (Block Development, Full Chip Only, or Integration mode)");
    const systemConfig = this.configService.getConfiguration();

    // Technology Node is currently OPTIONAL and NEUTRAL
    // Node multiplier defaults to 0 (no impact on cost)
    // This will be implemented in a future phase when Block Complexity is added
    // ============================================================
    // FLOW CONTROL: Block + Full Chip Integration
    // ============================================================
    // Three modes:
    // 1. Block + Full Chip Integration: fullChip.enabled === true && blocks.length > 0
    //    - Calculate Block resources (existing logic)
    //    - Calculate Full Chip Scope Definition resources (new: base = 1.0 + fixed, × timeline, apply percentages)
    //    - Combine: Total = Block Resources + Full Chip Scope Definition Resources
    // 2. Full Chip Only: fullChip.enabled === true && blocks.length === 0
    //    - Calculate Full Chip only (existing logic)
    // 3. Block Only: fullChip.enabled === false
    //    - Calculate Block only (existing logic)

    // ============================================================
    // BLOCK + FULL CHIP INTEGRATION FLOW
    // ============================================================
    const isIntegrationMode = projectConfig.fullChip?.enabled && projectConfig.blocks && projectConfig.blocks.length > 0;

    if (isIntegrationMode) {
      console.log("BLOCK + FULL CHIP INTEGRATION MODE");

      // ============================================================
      // STEP 1: Calculate Block Resources (using existing block logic)
      // ============================================================
      const baseResource = 0.5; // Constant base resource for blocks
      const costPerResourcePerMonth = systemConfig.costPerResourcePerMonth; // ₹4,00,000
      let totalBlockResources = 0.0;

      projectConfig.blocks.forEach((block, blockIndex) => {
        console.log(`\n========== [DEBUG] Block Calculation: "${block.blockName || 'Unknown'}" (Index: ${blockIndex}) ==========`);
        const blockComplexityFactors = Array.isArray(block.complexityFactors) ? block.complexityFactors : [];
        console.log(`[DEBUG] Block complexityFactors received: ${JSON.stringify(blockComplexityFactors)}`);
        const gateCount = Number(block.gateCount) || systemConfig.blockGateCount.baseGateCount;
        console.log(`[DEBUG] Block gateCount: ${gateCount}M`);
        const rtlDropCount = block.rtl_drop_count || 3;
        const blockTimeline = systemConfig.blockTimeline.find((t) => t.rtl_drop_count === rtlDropCount);
        const rtlDropsMonths = blockTimeline?.months || (rtlDropCount === 1 ? 2 : rtlDropCount === 2 ? 4 : 6);
        console.log(`[DEBUG] Block RTL drops: ${rtlDropCount} → ${rtlDropsMonths} months`);

        // Base Resource Value (before duration multiplication)
        const baseResourceValue = baseResource; // 0.5
        console.log(`[DEBUG] Block base resource: ${baseResourceValue}`);

        // Instance Scaling (as percentage, will be added to complexity sum)
        const baseGateCount = systemConfig.blockGateCount.baseGateCount;
        const gateIncrementStep = 1.0;
        const additionalResourcePercentage = systemConfig.blockGateCount.additionalResourcePercentage || 10;
        let instanceScalingPercentage = 0.0;
        if (gateCount > baseGateCount) {
          const extraGates = gateCount - baseGateCount;
          const extraMillions = Math.floor(extraGates / gateIncrementStep);
          instanceScalingPercentage = (extraMillions * additionalResourcePercentage) / 100;
          console.log(`[DEBUG] Block instance scaling: ${gateCount}M > ${baseGateCount}M → +${(instanceScalingPercentage * 100).toFixed(1)}%`);
        } else {
          console.log(`[DEBUG] Block instance scaling: ${gateCount}M <= ${baseGateCount}M → 0%`);
        }

        // Complexity Sum (same logic as block-only flow)
        let complexitySum = 0.0;
        console.log(`[DEBUG] Block complexity factors breakdown:`);
        if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
          const nodeValue = projectConfig.technology.toLowerCase();
          if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
            complexitySum += 10 / 100;
            console.log(`[DEBUG] Block Technology ${projectConfig.technology} (≤7nm): +10%`);
          } else {
            // For nodes >7nm, add 0% (nothing) - per Excel specification
            console.log(`[DEBUG] Block Technology ${projectConfig.technology} (>7nm): +0% (no technology uplift per Excel)`);
          }
        }
        // Design Maturity - Duration adjustment (not percentage)
        // New Design = +1 month, Revision = +0 months (no change)
        // This duration adjustment will be applied to rtlDropsMonths
        let designMaturityDurationAdjustment = 0.0;
        if (blockComplexityFactors.includes('new_design')) {
          designMaturityDurationAdjustment = 1.0; // +1 month
          console.log(`[Block "${block.blockName || 'Unknown'}"] Design Maturity (New Design): +1 month`);
        } else if (blockComplexityFactors.includes('revision')) {
          designMaturityDurationAdjustment = 0.0; // No change
          console.log(`[Block "${block.blockName || 'Unknown'}"] Design Maturity (Revision): +0 months (no change)`);
        }
        const hasNonNestedLP = blockComplexityFactors.includes('low_power_non_nested');
        const hasNestedLP = blockComplexityFactors.includes('low_power_nested');
        if (hasNonNestedLP) {
          const factor = systemConfig.blockComplexity.find(f => f.id === 'low_power_non_nested');
          if (factor && factor.enabled !== false) complexitySum += factor.resourcePercentage / 100;
        } else if (hasNestedLP) {
          const factor = systemConfig.blockComplexity.find(f => f.id === 'low_power_nested');
          if (factor && factor.enabled !== false) complexitySum += factor.resourcePercentage / 100;
        }
        if (blockComplexityFactors.includes('merged_mode_constraints')) {
          const factor = systemConfig.blockComplexity.find(f => f.id === 'merged_mode_constraints');
          if (factor && factor.enabled !== false) complexitySum += factor.resourcePercentage / 100;
        }
        if (blockComplexityFactors.includes('synthesis_complexity')) {
          const factor = systemConfig.blockComplexity.find(f => f.id === 'synthesis_complexity');
          if (factor && factor.enabled !== false) complexitySum += factor.resourcePercentage / 100;
        }
        if (blockComplexityFactors.includes('macro_intensive')) {
          const factor = systemConfig.blockComplexity.find(f => f.id === 'macro_intensive');
          if (factor && factor.enabled !== false) complexitySum += factor.resourcePercentage / 100;
        }
        const hasDFT = block.dft || blockComplexityFactors.includes('dft_block_level');
        const hasIO = blockComplexityFactors.includes('io_blocks');
        const hasAnalog = blockComplexityFactors.includes('physical_blocks');
        let dftComponentPercentage = 0;
        if (hasDFT) {
          const dftContext = systemConfig.dftContextPercentages || { dftAlone: 60, dftWithIoOrAnalog: 70, dftWithIoAndAnalog: 80 };
          if (hasIO && hasAnalog) dftComponentPercentage = dftContext.dftWithIoAndAnalog;
          else if (hasIO || hasAnalog) dftComponentPercentage = dftContext.dftWithIoOrAnalog;
          else dftComponentPercentage = dftContext.dftAlone;
          complexitySum += dftComponentPercentage / 100;
        }
        if (hasIO) {
          const ioFactor = systemConfig.blockComplexity.find(f => f.id === 'io_blocks');
          if (ioFactor && ioFactor.enabled !== false) complexitySum += ioFactor.resourcePercentage / 100;
        }
        if (hasAnalog) {
          const analogFactor = systemConfig.blockComplexity.find(f => f.id === 'physical_blocks');
          if (analogFactor && analogFactor.enabled !== false) complexitySum += analogFactor.resourcePercentage / 100;
        }
        // Hierarchical design: +100%, Flat design: 0%
        // Design type is MANDATORY for Block 2+ (blockIndex >= 1)
        // Block 1 (blockIndex === 0) doesn't need design type - they build first block first
        const hasHierarchical = blockComplexityFactors.includes('hierarchical');
        const hasFlat = blockComplexityFactors.includes('flat') || projectConfig.isFlat;
        console.log(`[DEBUG] Block design type check: hierarchical=${hasHierarchical}, flat=${hasFlat}, blockIndex=${blockIndex}`);
        
        // Only validate design type for Block 2 onwards (skip Block 1)
        if (blockIndex > 0 && !hasHierarchical && !hasFlat) {
          throw new BadRequestException(
            `Block "${block.blockName || 'Unknown'}": Design type is mandatory from Block 2 onwards. Please select either 'hierarchical' or 'flat' design type.`
          );
        }
        
        if (hasHierarchical) {
          complexitySum += 1.0; // +100%
          console.log(`[DEBUG] Block Hierarchical: +100%`);
        } else if (hasFlat) {
          // Flat design: 0% (no addition to complexitySum)
          console.log(`[DEBUG] Block Flat: +0%`);
        }

        // Calculate Total Base Resource: Base × (1 + Total Percentage)
        // Total Percentage = Instance Scaling % + All Complexity %
        const totalPercentage = instanceScalingPercentage + complexitySum;
        console.log(`[DEBUG] Block total percentage: ${(instanceScalingPercentage * 100).toFixed(1)}% (instance scaling) + ${(complexitySum * 100).toFixed(1)}% (complexity) = ${(totalPercentage * 100).toFixed(1)}%`);
        const totalBaseResource = baseResourceValue * (1 + totalPercentage);
        console.log(`[DEBUG] Block total base resource: ${baseResourceValue} × (1 + ${totalPercentage.toFixed(2)}) = ${totalBaseResource.toFixed(2)}`);

        // Apply Design Maturity Duration Adjustment
        // Design Maturity affects duration (not percentage): Revision = 0, New Design = +1 month
        const adjustedRtlDropsMonths = rtlDropsMonths + designMaturityDurationAdjustment;
        console.log(`[Block "${block.blockName || 'Unknown'}"] Duration adjustment: ${rtlDropsMonths} months + ${designMaturityDurationAdjustment} months (Design Maturity) = ${adjustedRtlDropsMonths} months`);

        // Multiply by duration to get final resources for this block
        // Formula: Base × (1 + All Percentages) × Months
        const finalBlockResources = totalBaseResource * adjustedRtlDropsMonths;
        console.log(`[DEBUG] Block final resources: ${totalBaseResource.toFixed(2)} × ${adjustedRtlDropsMonths} months = ${finalBlockResources.toFixed(2)}`);
        totalBlockResources += finalBlockResources;
        console.log(`[DEBUG] Block cumulative total: ${totalBlockResources.toFixed(2)}`);
        console.log(`========== [DEBUG] End Block Calculation ==========\n`);
      });

      // Apply Block Count Scaling to resources (not price)
      const numberOfBlocks = projectConfig.blocks.length;
      let blockCountUplift = 0.0;
      if (numberOfBlocks >= 9 && numberOfBlocks <= 18) {
        blockCountUplift = 0.10;
      } else if (numberOfBlocks > 18) {
        blockCountUplift = 0.20;
      }
      console.log(`[DEBUG] Block count uplift: ${numberOfBlocks} blocks → ${(blockCountUplift * 100).toFixed(0)}%`);
      const totalBlockResourcesWithUplift = totalBlockResources * (1 + blockCountUplift);
      console.log(`[DEBUG] Total block resources: ${totalBlockResources.toFixed(2)} × (1 + ${blockCountUplift.toFixed(2)}) = ${totalBlockResourcesWithUplift.toFixed(2)}`);

      // ============================================================
      // STEP 2: Calculate Full Chip Scope Definition Resources (new logic)
      // ============================================================
      // 2a: Base = 1.0 (PnR default) + Other Fixed Resources
      const fullChipBase = 1.0; // PnR always added
      let fixedResourcesSum = 0.0;
      if (projectConfig.fullChip.factors && projectConfig.fullChip.factors.length > 0) {
        projectConfig.fullChip.factors.forEach((factorId) => {
          const normalizedFactorId = factorId.replace(/-/g, '_');
          let fixedFactor = systemConfig.fullChip.fixed.find((f) => f.id === normalizedFactorId);
          if (!fixedFactor) fixedFactor = systemConfig.fullChip.fixed.find((f) => f.id === factorId);
          if (fixedFactor && fixedFactor.id !== 'pnr') { // PnR already included in base
            const resourceValue = Number(fixedFactor.resources) || 0;
            fixedResourcesSum += resourceValue;
          }
        });
      }
      const fullChipBaseWithFixed = fullChipBase + fixedResourcesSum;

      // 2b: Multiply by Timeline Months
      const fullChipRtlDropCount = projectConfig.fullChip.rtl_drop_count || 3;
      const fullChipTimeline = systemConfig.fullChipTimeline.find((t) => t.rtl_drop_count === fullChipRtlDropCount);
      const baseFullChipTimelineMonths = fullChipTimeline?.months || (fullChipRtlDropCount === 1 ? 3 : fullChipRtlDropCount === 2 ? 5 : 7);
      
      // Apply Design Maturity Duration Adjustment for Full Chip
      // Design Maturity affects duration (not percentage): Revision = 0, New Design = +1 month
      let fullChipDesignMaturityAdjustment = 0.0;
      const designMaturityValue = projectConfig.fullChip?.designMaturity;
      console.log(`[Integration] Full Chip Design Maturity value from config: "${designMaturityValue}" (type: ${typeof designMaturityValue}, fullChip object: ${JSON.stringify({ designMaturity: projectConfig.fullChip?.designMaturity, enabled: projectConfig.fullChip?.enabled })})`);
      
      // Check with both strict and loose comparison to handle any type issues
      if (designMaturityValue === 'new_design' || String(designMaturityValue) === 'new_design') {
        fullChipDesignMaturityAdjustment = 1.0; // +1 month
        console.log(`[Integration] Full Chip Design Maturity (New Design): +1 month`);
      } else if (designMaturityValue === 'revision' || String(designMaturityValue) === 'revision') {
        fullChipDesignMaturityAdjustment = 0.0; // No change
        console.log(`[Integration] Full Chip Design Maturity (Revision): +0 months (no change)`);
      } else {
        console.log(`[Integration] WARNING: Full Chip Design Maturity not set or invalid value ("${designMaturityValue}"), adjustment = 0 months`);
      }
      const fullChipTimelineMonths = baseFullChipTimelineMonths + fullChipDesignMaturityAdjustment;
      console.log(`[Integration] Full Chip duration adjustment: ${baseFullChipTimelineMonths} months + ${fullChipDesignMaturityAdjustment} months (Design Maturity) = ${fullChipTimelineMonths} months`);

      // 2c: Apply Percentage Factors
      console.log(`\n========== [DEBUG] Full Chip Percentage Calculation ==========`);
      console.log(`[DEBUG] Full Chip percentageFactors received: ${JSON.stringify(projectConfig.fullChip.percentageFactors || [])}`);
      console.log(`[DEBUG] Full Chip percentageFactorLevels received: ${JSON.stringify(projectConfig.fullChip.percentageFactorLevels || {})}`);
      let totalPercentage = 0.0;
      if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
        const nodeValue = projectConfig.technology.toLowerCase();
        if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
          totalPercentage += 10 / 100;
          console.log(`[DEBUG] Full Chip Technology ${projectConfig.technology} (≤7nm): +10%`);
        } else {
          // For nodes >7nm, add 0% (nothing) - per Excel specification
          console.log(`[DEBUG] Full Chip Technology ${projectConfig.technology} (>7nm): +0% (no technology uplift per Excel)`);
        }
      }
      if (projectConfig.fullChip.fullChipBlocksTier) {
        if (projectConfig.fullChip.fullChipBlocksTier === '9to18') {
          totalPercentage += 10 / 100;
          console.log(`[DEBUG] Full Chip Blocks Scaling (9to18): +10%`);
        } else if (projectConfig.fullChip.fullChipBlocksTier === 'gt18') {
          totalPercentage += 20 / 100;
          console.log(`[DEBUG] Full Chip Blocks Scaling (gt18): +20%`);
        }
      } else {
        console.log(`[DEBUG] Full Chip Blocks Scaling: fullChipBlocksTier not set, using numberOfBlocks=${numberOfBlocks} → 0%`);
      }
      projectConfig.fullChip.percentageFactors?.forEach((factorId) => {
        if (factorId === 'dft_top_level' || factorId === 'blocks_count') {
          console.log(`[DEBUG] Full Chip percentageFactor "${factorId}": SKIPPED (handled separately)`);
          return;
        }
        const factor = systemConfig.fullChip.percentage.find((f) => f.id === factorId);
        if (factor && factor.enabled !== false && (!factor.levels || factor.levels.length === 0)) {
          const factorPercentage = (Number(factor.resourcePercentage) || 0) / 100;
          totalPercentage += factorPercentage;
          console.log(`[DEBUG] Full Chip percentageFactor "${factorId}": +${factor.resourcePercentage}%`);
        } else if (!factor) {
          console.log(`[DEBUG] Full Chip percentageFactor "${factorId}": NOT FOUND in config`);
        } else if (factor.levels && factor.levels.length > 0) {
          console.log(`[DEBUG] Full Chip percentageFactor "${factorId}": HAS LEVELS (should be in percentageFactorLevels)`);
        }
      });
      if (projectConfig.fullChip.percentageFactorLevels) {
        Object.entries(projectConfig.fullChip.percentageFactorLevels).forEach(([factorId, levelId]) => {
          if (factorId === 'blocks_count') {
            console.log(`[DEBUG] Full Chip percentageFactorLevel "${factorId}": SKIPPED (handled separately)`);
            return;
          }
          const factor = systemConfig.fullChip.percentage.find((f) => f.id === factorId);
          if (factor && factor.enabled !== false && factor.levels) {
            const level = factor.levels.find((l) => l.id === levelId);
            if (level) {
              const levelPercentage = (Number(level.resourcePercentage) || 0) / 100;
              totalPercentage += levelPercentage;
              console.log(`[DEBUG] Full Chip percentageFactorLevel "${factorId}"="${levelId}": +${level.resourcePercentage}%`);
            } else {
              console.log(`[DEBUG] Full Chip percentageFactorLevel "${factorId}"="${levelId}": LEVEL NOT FOUND`);
            }
          } else {
            console.log(`[DEBUG] Full Chip percentageFactorLevel "${factorId}": FACTOR NOT FOUND or disabled`);
          }
        });
      }
      
      // 2c0: Power Domains
      // None = 0%, Non-nested = 5%, Nested = 10%
      if (projectConfig.fullChip.powerDomains) {
        if (projectConfig.fullChip.powerDomains === 'non_nested') {
          totalPercentage += 0.05; // 5%
          console.log(`[DEBUG] Full Chip Power Domains (Non-nested): +5%`);
        } else if (projectConfig.fullChip.powerDomains === 'nested') {
          totalPercentage += 0.10; // 10%
          console.log(`[DEBUG] Full Chip Power Domains (Nested): +10%`);
        }
      }
      
      // 2c1: Apply Glue Logic scaling (if enabled) - Same as Full Chip Configuration (2%, 4%, 6%, 8%)
      // Frontend sends instanceCount as: 1.5 (<1.5M), 2.5 (<2.5M), 3.5 (<3.5M), 4.5 (<4.5M)
      // Logic: <=1.5M = 2%, <=2.5M = 4%, <=3.5M = 6%, <=4.5M = 8%, >4.5M = 8% (capped)
      console.log(`[DEBUG] Full Chip glueLogic: ${projectConfig.fullChip.glueLogic}, instanceCount: ${projectConfig.fullChip.instanceCount}`);
      if (projectConfig.fullChip.glueLogic === true && projectConfig.fullChip.instanceCount) {
        const instanceCount = Number(projectConfig.fullChip.instanceCount);
        let glueLogicPercentage = 2; // Default for <=1.5M

        if (instanceCount <= 1.5) {
          glueLogicPercentage = 2; // <=1.5M: 2%
        } else if (instanceCount <= 2.5) {
          glueLogicPercentage = 4; // <=2.5M: 4%
        } else if (instanceCount <= 3.5) {
          glueLogicPercentage = 6; // <=3.5M: 6%
        } else if (instanceCount <= 4.5) {
          glueLogicPercentage = 8; // <=4.5M: 8%
        } else {
          glueLogicPercentage = 8; // >4.5M: 8% (capped)
        }

        totalPercentage += glueLogicPercentage / 100;
        console.log(`[DEBUG] Full Chip Glue Logic: +${glueLogicPercentage}% (instanceCount=${instanceCount}M)`);
      } else if (projectConfig.fullChip.glueLogic === true) {
        totalPercentage += 0.02; // Default 2%
        console.log(`[DEBUG] Full Chip Glue Logic: +2% (default, instanceCount not provided)`);
      } else {
        console.log(`[DEBUG] Full Chip Glue Logic: NOT enabled`);
      }
      
      // 2c2: Check for Synthesis in fixed factors (PnR) - if PnR is selected, also add Synthesis percentage
      // Frontend sends Synthesis as 'pnr' in factors, but we need to add synthesis_full_chip percentage
      // Same logic as Full Chip Configuration
      // Check if synthesis_full_chip is already in percentageFactors to avoid double counting
      console.log(`[DEBUG] Full Chip factors received: ${JSON.stringify(projectConfig.fullChip.factors || [])}`);
      const synthesisAlreadyInPercentageFactors = projectConfig.fullChip.percentageFactors && 
        (projectConfig.fullChip.percentageFactors.includes('synthesis_full_chip') || 
         projectConfig.fullChip.percentageFactors.includes('synthesis'));
      console.log(`[DEBUG] Full Chip Synthesis check: factors.includes('pnr')=${projectConfig.fullChip.factors?.includes('pnr')}, synthesisAlreadyInPercentageFactors=${synthesisAlreadyInPercentageFactors}`);
      
      if (projectConfig.fullChip.factors && projectConfig.fullChip.factors.includes('pnr') && !synthesisAlreadyInPercentageFactors) {
        const synthesisFactor = systemConfig.fullChip.percentage.find(f => f.id === 'synthesis_full_chip' && f.enabled !== false);
        if (synthesisFactor) {
          const synthesisPercentage = (Number(synthesisFactor.resourcePercentage) || 0) / 100;
          totalPercentage += synthesisPercentage;
          console.log(`[DEBUG] Full Chip Synthesis (from PnR factor): +${synthesisFactor.resourcePercentage}%`);
        } else {
          // Fallback if synthesis_full_chip not found in config
          totalPercentage += 0.05; // 5% fallback
          console.warn(`[DEBUG] Full Chip Synthesis factor not found in config, using fallback value: +5%`);
        }
      } else if (synthesisAlreadyInPercentageFactors) {
        console.log(`[DEBUG] Full Chip Synthesis already in percentageFactors, skipping addition from PnR`);
      } else {
        console.log(`[DEBUG] Full Chip Synthesis: NOT added (PnR not in factors or already in percentageFactors)`);
      }
      
      console.log(`[DEBUG] Full Chip TOTAL PERCENTAGE: ${(totalPercentage * 100).toFixed(1)}%`);
      console.log(`========== [DEBUG] End Full Chip Percentage Calculation ==========\n`);
      
      // DFT is now handled as a fixed resource (1.0), NOT as a percentage
      // It will be added after percentage calculation, then multiply by duration

      // Apply percentage factors to base resources
      // CRITICAL: Same formula as Full Chip Configuration
      // FORMULA: Base × (1 + complexity percentage) = x, then x + DFT = y, then y × duration = final
      // Base includes: PnR (1.0) + Fixed Resources (IR Drop, STA, PV)
      const fullChipBaseResource = 1.0; // PnR base
      const additionalFixedResources = fullChipBaseWithFixed - fullChipBaseResource; // Other fixed resources (IR Drop, STA, PV)
      
      // Base = PnR + Fixed Resources
      const base = fullChipBaseResource + additionalFixedResources;
      
      // x = Base × (1 + totalPercentage)
      const resourcesAfterComplexity = base * (1 + totalPercentage);
      
      console.log(`[Integration] Full Chip resource calculation:`);
      console.log(`  Base resource (PnR): ${fullChipBaseResource.toFixed(2)}`);
      console.log(`  Additional fixed resources: ${additionalFixedResources.toFixed(2)}`);
      console.log(`  Base (PnR + Fixed): ${base.toFixed(2)}`);
      console.log(`  Complexity percentage: ${(totalPercentage * 100).toFixed(1)}%`);
      console.log(`  Resources after complexity: ${base.toFixed(2)} × (1 + ${totalPercentage.toFixed(2)}) = ${resourcesAfterComplexity.toFixed(2)}`);
      
      // Use resourcesAfterComplexity for next step (adding DFT)
      const fullChipResourcesAfterPercentage = resourcesAfterComplexity;
      
      // ============================================================
      // STEP 2d: Add DFT as Fixed Resource (if enabled)
      // ============================================================
      // DFT is a fixed resource, multiplied by technology node multiplier, added AFTER base resource and complexity factors
      // Then the whole thing (base + complexity + DFT) is multiplied by duration
      let fullChipResourcesWithDft = fullChipResourcesAfterPercentage;
      if (projectConfig.fullChip.dft) {//
        const dftBaseResource = 1.0;
        
        // Get technology node multiplier to multiply with DFT
        // According to Excel: Only 7nm and below (≤7nm) get 10% multiplier, all other nodes get 0% (multiplier = 1.0)
        let techNodeMultiplier = 1.0; // Default: no multiplier (1.0 = 100%)
        if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
          const nodeValue = projectConfig.technology.toLowerCase();
          if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
            techNodeMultiplier = 1.0 + (10 / 100); // ≤7nm: 1.10 (10% multiplier)
          } else {
            // For nodes >7nm, multiplier = 1.0 (no increase) - per Excel specification
            techNodeMultiplier = 1.0;
          }
        }
        
        // Multiply DFT resource by technology node multiplier
        const dftFixedResource = dftBaseResource * techNodeMultiplier;
        fullChipResourcesWithDft = fullChipResourcesAfterPercentage + dftFixedResource;
        console.log(`[Integration] DFT Top Level: ${dftBaseResource} × ${techNodeMultiplier.toFixed(2)} (tech node) = ${dftFixedResource.toFixed(2)} resource`);
      }
      
      // Multiply by duration
      const finalFullChipResources = fullChipResourcesWithDft * fullChipTimelineMonths;
      console.log(`[DEBUG] Full Chip final calculation:`);
      console.log(`[DEBUG]   Base (PnR + Fixed): ${base.toFixed(2)}`);
      console.log(`[DEBUG]   Complexity percentage: ${(totalPercentage * 100).toFixed(1)}%`);
      console.log(`[DEBUG]   Resources after complexity: ${resourcesAfterComplexity.toFixed(2)}`);
      if (projectConfig.fullChip.dft) {
        const dftBaseResource = 1.0;
        let techNodeMultiplier = 1.0;
        if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
          const nodeValue = projectConfig.technology.toLowerCase();
          if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
            techNodeMultiplier = 1.0 + (10 / 100);
          } else {
            // For nodes >7nm, multiplier = 1.0 (no increase) - per Excel specification
            techNodeMultiplier = 1.0;
          }
        }
        const dftFixedResource = dftBaseResource * techNodeMultiplier;
        console.log(`[DEBUG]   DFT: +${dftFixedResource.toFixed(2)} (${dftBaseResource} × ${techNodeMultiplier.toFixed(2)} tech node)`);
      } else {
        console.log(`[DEBUG]   DFT: +0.0`);
      }
      console.log(`[DEBUG]   Total base (after DFT): ${fullChipResourcesWithDft.toFixed(2)}`);
      console.log(`[DEBUG]   Duration: ${fullChipTimelineMonths} months`);
      console.log(`[DEBUG]   Final Full Chip resources: ${fullChipResourcesWithDft.toFixed(2)} × ${fullChipTimelineMonths} = ${finalFullChipResources.toFixed(2)}`);
      console.log(`[Integration] Total base: ${fullChipResourcesWithDft.toFixed(2)}`);
      console.log(`[Integration] Full Chip resources: ${fullChipResourcesWithDft.toFixed(2)} × ${fullChipTimelineMonths} months = ${finalFullChipResources.toFixed(2)}`);

      // ============================================================
      // STEP 3: Combine Block + Full Chip Scope Definition Resources, then multiply by cost
      // ============================================================
      // Formula: Total Resources = Block Resources (with uplift) + Full Chip Scope Definition Resources
      //          Total Price = Total Resources × Cost per Resource per Month
      const totalResources = totalBlockResourcesWithUplift + finalFullChipResources;
      const totalProjectPrice = totalResources * costPerResourcePerMonth;

      console.log(`\n========== [DEBUG] FINAL SUMMARY ==========`);
      console.log(`[DEBUG] Block Resources (before uplift): ${totalBlockResources.toFixed(3)}`);
      console.log(`[DEBUG] Block Resources (after uplift ${(blockCountUplift * 100).toFixed(0)}%): ${totalBlockResourcesWithUplift.toFixed(3)}`);
      console.log(`[DEBUG] Full Chip Scope Definition Resources: ${finalFullChipResources.toFixed(3)}`);
      console.log(`[DEBUG] Total Resources: ${totalResources.toFixed(3)}`);
      console.log(`[DEBUG] Cost per resource per month: ₹${costPerResourcePerMonth.toLocaleString('en-IN')}`);
      console.log(`[DEBUG] Total Price: ${totalResources.toFixed(3)} × ₹${costPerResourcePerMonth.toLocaleString('en-IN')} = ₹${Math.round(totalProjectPrice).toLocaleString('en-IN')}`);
      console.log(`========== [DEBUG] END FINAL SUMMARY ==========\n`);

      console.log(`[Integration] Block Resources (before uplift): ${totalBlockResources.toFixed(3)}`);
      console.log(`[Integration] Block Resources (after uplift ${(blockCountUplift * 100).toFixed(0)}%): ${totalBlockResourcesWithUplift.toFixed(3)}`);
      console.log(`[Integration] Full Chip Scope Definition Resources: ${finalFullChipResources.toFixed(3)}`);
      console.log(`[Integration] Total Resources: ${totalResources.toFixed(3)}`);
      console.log(`[Integration] Total Price: ${totalResources.toFixed(3)} × ₹${costPerResourcePerMonth.toLocaleString('en-IN')} = ₹${Math.round(totalProjectPrice).toLocaleString('en-IN')}`);

      // ============================================================
      // STEP 4: Calculate Duration (Maximum of all timelines)
      // ============================================================
      // The project duration is defined by the longest path
      // max(Full Chip Duration + Design Maturity, Block 1 Duration + Design Maturity, Block 2 Duration + Design Maturity, ...)
      // CRITICAL: Design Maturity adjustment (+1 month for new_design) must be included in duration calculation for both Full Chip and Blocks
      // Full Chip duration already includes Design Maturity adjustment from step 2b
      let maxDuration = fullChipTimelineMonths;
      console.log(`[Integration Duration Calc] Full Chip (RTL drops: ${fullChipRtlDropCount}): Base=${baseFullChipTimelineMonths} months, Design Maturity adjustment=${fullChipDesignMaturityAdjustment} months, Adjusted=${fullChipTimelineMonths} months`);

      projectConfig.blocks.forEach(block => {
        const blockComplexityFactors = Array.isArray(block.complexityFactors) ? block.complexityFactors : [];
        const rtlDropCount = block.rtl_drop_count || 3;
        const blockTimeline = systemConfig.blockTimeline.find((t) => t.rtl_drop_count === rtlDropCount);
        const baseBlockMonths = blockTimeline?.months || (rtlDropCount === 1 ? 2 : rtlDropCount === 2 ? 4 : 6);
        
        // Apply Design Maturity duration adjustment
        let designMaturityAdjustment = 0.0;
        if (blockComplexityFactors.includes('new_design')) {
          designMaturityAdjustment = 1.0; // +1 month
          console.log(`[Integration Duration Calc] Block "${block.blockName || 'Unknown'}" (RTL drops: ${rtlDropCount}): Base=${baseBlockMonths} months, Design Maturity (New Design)=+${designMaturityAdjustment} month, Adjusted=${baseBlockMonths + designMaturityAdjustment} months`);
        } else if (blockComplexityFactors.includes('revision')) {
          designMaturityAdjustment = 0.0; // No change
          console.log(`[Integration Duration Calc] Block "${block.blockName || 'Unknown'}" (RTL drops: ${rtlDropCount}): Base=${baseBlockMonths} months, Design Maturity (Revision)=+${designMaturityAdjustment} months, Adjusted=${baseBlockMonths + designMaturityAdjustment} months`);
        } else {
          console.log(`[Integration Duration Calc] Block "${block.blockName || 'Unknown'}" (RTL drops: ${rtlDropCount}): Base=${baseBlockMonths} months, Design Maturity=not selected, Adjusted=${baseBlockMonths} months`);
        }
        const adjustedBlockMonths = baseBlockMonths + designMaturityAdjustment;
        
        console.log(`[Integration Duration Calc] Comparing: Block "${block.blockName || 'Unknown'}" = ${adjustedBlockMonths} months vs Current max = ${maxDuration} months`);
        if (adjustedBlockMonths > maxDuration) {
          maxDuration = adjustedBlockMonths;
          console.log(`[Integration Duration Calc] New max duration: ${maxDuration} months (from block "${block.blockName || 'Unknown'}")`);
        } else {
          console.log(`[Integration Duration Calc] Full Chip duration (${maxDuration} months) remains the maximum`);
        }
      });

      console.log(`[Integration Flow] Final project duration: ${maxDuration} months (includes Design Maturity adjustments)`);
      console.log(`[Integration Flow] Breakdown: Full Chip = ${fullChipTimelineMonths} months (base: ${baseFullChipTimelineMonths} + Design Maturity: ${fullChipDesignMaturityAdjustment})`);
      return {
        months: maxDuration, // Return MAX duration (includes Design Maturity adjustments)
        price: Math.round(totalProjectPrice),
      };
    }

    // ============================================================
    // FULL CHIP ONLY FLOW (No Blocks)
    // ============================================================
    if (projectConfig.fullChip?.enabled) {
      console.log("FULL CHIP FIXED FUNCTION HIT");

      // CRITICAL: Block effort = 0 for Full-Chip projects
      // Block parameters (gate count, complexity factors) are used as SCALING factors on Full-Chip effort
      // They do NOT create separate Block effort - they only scale the Full-Chip base effort
      const breakdownBlockEffort = 0;

      // ============================================================
      // STEP 1: Get Full Chip Base Timeline Effort (from RTL drops)
      // ============================================================
      // CRITICAL: Base timeline effort comes from timeline configuration based on RTL drops
      // The timeline months value IS the base timeline effort (e.g., 3 RTL drops → 7.0 months = 7.0 base effort)
      const rtlDropCount = projectConfig.fullChip.rtl_drop_count || 3; // Default to 3 if not set
      let baseTimelineEffort = 0.0;

      const fullChipTimeline = systemConfig.fullChipTimeline.find(
        (t) => t.rtl_drop_count === rtlDropCount,
      );
      if (fullChipTimeline) {
        // Use the timeline months value as the base timeline effort
        baseTimelineEffort = Number(fullChipTimeline.months) || 0;
      } else {
        // Fallback to default timeline for 3 RTL drops
        const defaultTimeline = systemConfig.fullChipTimeline.find(t => t.rtl_drop_count === 3);
        baseTimelineEffort = Number(defaultTimeline?.months) || 7.0;
        console.warn(`[Full-Chip] Timeline not found for RTL drops: ${rtlDropCount}, defaulting to 3 RTL drops timeline`);
      }

      console.log(`[Full-Chip] Base timeline effort: ${baseTimelineEffort} (RTL drops: ${rtlDropCount})`);

      // ============================================================
      // STEP 1b: Sum Fixed Full-Chip Resources
      // ============================================================
      // CRITICAL: PnR (1.0) is ALWAYS included as base when full chip is enabled
      // Other fixed resources (IR Drop, PV, STA) are added to the PnR base
      // Formula: baseEffort = (PnR base + other fixed resources) × baseTimelineEffort
      // Example: (1.0 + 0.0) × 7.0 = 7.0 (PnR only)
      // Example: (1.0 + 0.5) × 7.0 = 10.5 (PnR + IR Drop)
      const fullChipBase = 1.0; // PnR always included when full chip is enabled
      let otherFixedResourcesSum = 0.0;
      console.log(`[Full-Chip] Received fixed factors from request:`, projectConfig.fullChip.factors);
      console.log(`[Full-Chip] Available fixed factors in config:`, systemConfig.fullChip.fixed.map(f => ({ id: f.id, name: f.name, resources: f.resources })));

      if (projectConfig.fullChip.factors && projectConfig.fullChip.factors.length > 0) {
        projectConfig.fullChip.factors.forEach((factorId) => {
          // CRITICAL: Normalize factor ID to handle both 'ir-drop' (frontend) and 'ir_drop' (backend) formats
          const normalizedFactorId = factorId.replace(/-/g, '_');

          // Try to find factor with normalized ID first, then fallback to original ID
          let fixedFactor = systemConfig.fullChip.fixed.find((f) => f.id === normalizedFactorId);
          if (!fixedFactor) {
            fixedFactor = systemConfig.fullChip.fixed.find((f) => f.id === factorId);
          }

          if (fixedFactor && fixedFactor.id !== 'pnr') {
            // PnR is already included in fullChipBase, so skip it here
            // CRITICAL: Ensure resources value is converted to a number to prevent string concatenation
            const resourceValue = Number(fixedFactor.resources) || 0;
            otherFixedResourcesSum = Number(otherFixedResourcesSum) + resourceValue;
            console.log(`[Full-Chip] Added fixed resource: ${factorId} (normalized: ${normalizedFactorId}) = ${resourceValue} (raw: ${fixedFactor.resources})`);
          } else if (fixedFactor && fixedFactor.id === 'pnr') {
            console.log(`[Full-Chip] PnR factor detected but already included in base (1.0), skipping duplicate`);
          } else {
            console.warn(`[Full-Chip] WARNING: Fixed factor '${factorId}' (normalized: '${normalizedFactorId}') not found in system configuration. Available factors: ${systemConfig.fullChip.fixed.map(f => f.id).join(', ')}`);
          }
        });
      }

      // CRITICAL: Ensure final sum is a number
      otherFixedResourcesSum = Number(otherFixedResourcesSum) || 0;
      const fixedResourcesSum = fullChipBase + otherFixedResourcesSum;
      console.log(`[Full-Chip] Fixed resources: PnR base (${fullChipBase}) + other fixed (${otherFixedResourcesSum}) = ${fixedResourcesSum}`);

      // ============================================================
      // STEP 1c: Combine Base Timeline Effort × Fixed Resources
      // ============================================================
      // This is the base effort BEFORE percentage adders are applied
      // CRITICAL: Ensure all values are numbers to prevent type conversion errors
      // Formula: baseEffort = (PnR base + other fixed resources) × baseTimelineEffort
      // Example: (1.0 + 0.0) × 7.0 = 7.0 (PnR only, 7 months)
      const baseEffort = Number(fixedResourcesSum) * Number(baseTimelineEffort);
      console.log(`[Full-Chip] Base effort (fixed × timeline): ${fixedResourcesSum} × ${baseTimelineEffort} = ${baseEffort}`);

      // STEP 2: Calculate total percentage from all Full-Chip percentage factors (ADDITIVE)
      // CRITICAL: All percentages are stored as whole numbers (e.g., 10 for 10%)
      // Must normalize by dividing by 100 before adding to total percentage
      // All percentages are collected additively, then applied ONCE to baseEffort
      let totalPercentage = 0.0; // Sum of all percentage decimals (e.g., 0.10 + 0.30 = 0.40)
      const appliedFactorIds = new Set<string>(); // Track applied factors to prevent duplicates
      console.log(`[Full-Chip] Starting percentage calculation. Initial totalPercentage: ${totalPercentage}`);

      // 2a: Add Technology Node percentage to total (if enabled)
      // According to Excel: Only 7nm and below (≤7nm) get 10%, all other nodes get 0%
      if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
        const nodeValue = projectConfig.technology.toLowerCase();
        // For nodes ≤7nm (5nm, 7nm, 3nm, 2nm), use 10% uplift
        if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
          totalPercentage += 0.10; // ≤7nm = +10%
          console.log(`[Full-Chip] Technology Node "${projectConfig.technology}" (≤7nm): +10%`);
        } else {
          // For nodes >7nm, add 0% (nothing) - per Excel specification
          console.log(`[Full-Chip] Technology Node "${projectConfig.technology}" (>7nm): +0% (no technology uplift per Excel)`);
        }
      }

      // 2b: Apply Blocks Scaling based on explicit fullChipBlocksTier field (Full-Chip only)
      // CRITICAL: Use explicit UI selection instead of auto-calculating from blocks.length
      // This ensures Full-Chip projects have explicit control over blocks scaling
      // Blocks scaling is INDEPENDENT and ADDITIVE with all other percentage factors
      if (projectConfig.fullChip.fullChipBlocksTier) {
        let blocksScalingPercentage = 0;
        if (projectConfig.fullChip.fullChipBlocksTier === '9to18') {
          blocksScalingPercentage = 10; // 9-18 blocks = 10%
        } else if (projectConfig.fullChip.fullChipBlocksTier === 'gt18') {
          blocksScalingPercentage = 20; // 18+ blocks = 20%
        }
        // lt9 = 0% (no scaling)

        // CRITICAL: Always add blocks scaling if tier is set (even if 0% for lt9)
        // This ensures the factor is tracked and logged
        totalPercentage += blocksScalingPercentage / 100; // Normalize: divide by 100
        if (blocksScalingPercentage > 0) {
          appliedFactorIds.add('blocks_count');
          console.log(`[Full-Chip] Applied blocks scaling: ${projectConfig.fullChip.fullChipBlocksTier} = ${blocksScalingPercentage}% (totalPercentage now: ${totalPercentage})`);
        } else {
          console.log(`[Full-Chip] Blocks scaling: ${projectConfig.fullChip.fullChipBlocksTier} = 0% (no scaling applied)`);
        }
      } else {
        console.log(`[Full-Chip] Blocks scaling: fullChipBlocksTier not set, skipping blocks scaling`);
      }

      // ============================================================
      // 2b2: Aggregate Block Parameters as Full-Chip Scaling Factors
      // ============================================================
      // CRITICAL: Block parameters (gate count, complexity factors) act as SCALING factors on Full-Chip effort
      // They do NOT create separate Block effort - they only scale the Full-Chip base effort
      // 
      // Gate Scaling Rule:
      //   - Sum all block gate counts
      //   - Calculate: extra_gates = max(0, total_gates - (1.5M × number_of_blocks))
      //   - Apply: gate_scaling = floor(extra_gates / 1M) × 10%
      //   - Apply ONCE (not per block)
      //
      // Complexity Factors Rule:
      //   - For each complexity factor, take MAX across all blocks
      //   - Sum all MAX values
      //   - Add to totalPercentage
      //
      // These stack with fullChipBlocksTier (integration overhead) and other Full-Chip factors
      if (projectConfig.blocks && projectConfig.blocks.length > 0) {
        // Step 1: Calculate aggregate gate scaling
        const totalGateCount = projectConfig.blocks.reduce((sum, block) => {
          const gateCount = Number(block.gateCount) || systemConfig.blockGateCount.baseGateCount;
          return sum + gateCount;
        }, 0);

        const numberOfBlocks = projectConfig.blocks.length;
        const baseGateCountPerBlock = systemConfig.blockGateCount.baseGateCount; // 1.5M
        const totalBaseGateCount = baseGateCountPerBlock * numberOfBlocks;
        const extraGates = Math.max(0, totalGateCount - totalBaseGateCount);

        // Gate scaling: floor(extra_gates / 1M) × 10%
        const gateIncrementStep = 1.0; // 1M gates per increment
        const extraMillions = Math.floor(extraGates / gateIncrementStep);
        const gateScalingPercentage = extraMillions * (systemConfig.blockGateCount.additionalResourcePercentage || 10);

        if (gateScalingPercentage > 0) {
          totalPercentage += gateScalingPercentage / 100; // Normalize: divide by 100
          console.log(`[Full-Chip] Block gate scaling: totalGates=${totalGateCount.toFixed(1)}M, baseGates=${totalBaseGateCount.toFixed(1)}M, extraGates=${extraGates.toFixed(1)}M, extraMillions=${extraMillions}, scaling=${gateScalingPercentage}% (totalPercentage now: ${totalPercentage})`);
        } else {
          console.log(`[Full-Chip] Block gate scaling: totalGates=${totalGateCount.toFixed(1)}M, baseGates=${totalBaseGateCount.toFixed(1)}M, no extra gates, scaling=0%`);
        }

        // Step 2: Calculate block complexity factors (MAX per factor across all blocks)
        const complexityFactorMap = new Map<string, number>(); // factorId -> max percentage

        projectConfig.blocks.forEach((block, blockIndex) => {
          const blockComplexityFactors = block.complexityFactors || [];

          blockComplexityFactors.forEach((factorId) => {
            // Skip Low Power factors - they need special handling (mutually exclusive)
            if (factorId === 'low_power_nested' || factorId === 'low_power_non_nested') {
              return; // Handled separately below
            }

            const factor = systemConfig.blockComplexity.find(f => f.id === factorId);
            if (factor && factor.enabled !== false) {
              const factorPercentage = Number(factor.resourcePercentage) || 0;
              const currentMax = complexityFactorMap.get(factorId) || 0;
              complexityFactorMap.set(factorId, Math.max(currentMax, factorPercentage));
            }
          });
        });

        // Handle Low Power separately (mutually exclusive - take MAX of nested vs non-nested)
        let maxLowPowerNested = 0;
        let maxLowPowerNonNested = 0;

        projectConfig.blocks.forEach((block) => {
          const blockComplexityFactors = block.complexityFactors || [];
          if (blockComplexityFactors.includes('low_power_nested')) {
            const nestedFactor = systemConfig.blockComplexity.find(f => f.id === 'low_power_nested');
            if (nestedFactor && nestedFactor.enabled !== false) {
              maxLowPowerNested = Math.max(maxLowPowerNested, Number(nestedFactor.resourcePercentage) || 0);
            }
          }
          if (blockComplexityFactors.includes('low_power_non_nested')) {
            const nonNestedFactor = systemConfig.blockComplexity.find(f => f.id === 'low_power_non_nested');
            if (nonNestedFactor && nonNestedFactor.enabled !== false) {
              maxLowPowerNonNested = Math.max(maxLowPowerNonNested, Number(nonNestedFactor.resourcePercentage) || 0);
            }
          }
        });

        // Apply MAX of nested vs non-nested (they're mutually exclusive)
        if (maxLowPowerNested > 0 || maxLowPowerNonNested > 0) {
          const maxLowPower = Math.max(maxLowPowerNested, maxLowPowerNonNested);
          complexityFactorMap.set('low_power', maxLowPower);
        }

        // Sum all MAX complexity factor percentages
        let totalBlockComplexityPercentage = 0;
        complexityFactorMap.forEach((maxPercentage, factorId) => {
          totalBlockComplexityPercentage += maxPercentage;
          console.log(`[Full-Chip] Block complexity factor (MAX): ${factorId} = ${maxPercentage}%`);
        });

        if (totalBlockComplexityPercentage > 0) {
          totalPercentage += totalBlockComplexityPercentage / 100; // Normalize: divide by 100
          console.log(`[Full-Chip] Total block complexity scaling: ${totalBlockComplexityPercentage}% (totalPercentage now: ${totalPercentage})`);
        } else {
          console.log(`[Full-Chip] No block complexity factors selected, complexity scaling=0%`);
        }
      } else {
        console.log(`[Full-Chip] No blocks configured, skipping block parameter aggregation`);
      }

      // 2c: Handle simple checkbox factors (no levels) - ALL FACTORS ARE INDEPENDENT AND CUMULATIVE
      // CRITICAL: Each factor is processed independently - NO conditional branching that skips factors
      // This includes: abutment_floorplan, modes, merged_mode_constraints, macro_intensive, and other checkbox factors
      // NOTE: Abutment Floorplan is ONLY available for Full Chip Configuration (not Flat Implementation)
      // NOTE: Low Power - Full Chip is NOT available for execution scope (removed)
      // DFT (dft_top_level) is handled separately in step 2e to avoid double-counting
      // Blocks Scaling (blocks_count) is handled separately in step 2b (auto-applied)
      if (projectConfig.fullChip.percentageFactors && projectConfig.fullChip.percentageFactors.length > 0) {
        console.log(`[Full-Chip] Processing percentageFactors: ${projectConfig.fullChip.percentageFactors.join(', ')}`);
        projectConfig.fullChip.percentageFactors.forEach((factorId) => {
          // Skip only specific factors that are handled elsewhere - this does NOT affect other factors
          if (factorId === 'dft_top_level') {
            // DFT is added to totalPercentage in step 2e (independent of other factors)
            return;
          }
          if (factorId === 'blocks_count') {
            // Blocks Scaling is added in step 2b (auto-applied, independent of other factors)
            return;
          }
          // Skip Low Power - Full Chip - not available for execution scope (removed)
          if (factorId === 'low_power_full_chip') {
            console.log(`[Full-Chip] Skipping low_power_full_chip - not available for execution scope`);
            return;
          }

          // Process ALL other factors independently - no conditions that depend on other factors
          // This includes abutment_floorplan which is ONLY for Full Chip Configuration
          console.log(`[Full-Chip] Processing factor: ${factorId}`);
          const factor = systemConfig.fullChip.percentage.find((f) => f.id === factorId);
          if (factor && factor.enabled !== false && (!factor.levels || factor.levels.length === 0)) {
            if (!appliedFactorIds.has(factorId)) {
              // CRITICAL: All factors are cumulative - Low Power, Abutment Floorplan, Modes, etc. are ALL added independently
              // Example: If both Low Power (10%) and Abutment Floorplan (10%) are enabled:
              //   - Low Power is added here (step 2c)
              //   - Abutment Floorplan is added here (step 2c)
              //   - Both are cumulative: totalPercentage = 0.10 + 0.10 = 0.20
              const factorPercentage = (Number(factor.resourcePercentage) || 0) / 100;
              totalPercentage += factorPercentage;
              appliedFactorIds.add(factorId);
              console.log(`[Full-Chip] Applied percentage factor: ${factorId} = ${factor.resourcePercentage}% (totalPercentage now: ${totalPercentage})`);
            } else {
              console.log(`[Full-Chip] Factor '${factorId}' already applied, skipping duplicate`);
            }
          } else {
            // Log if factor not found or disabled (for debugging)
            if (!factor) {
              console.log(`[Full-Chip] Factor '${factorId}' not found in config, checking fallback...`);
              // Fallback: Use expected values for known factors if not in config
              // This ensures calculation works even if factors are missing from database
              const fallbackPercentages: Record<string, number> = {
                'abutment_floorplan': 10,
                'merged_mode_constraints': 10,
                'analog_ip_integration': 10,
                'macro_intensive': 10,
                'modes': 10,
              };
              if (fallbackPercentages[factorId] && !appliedFactorIds.has(factorId)) {
                const fallbackPercentage = fallbackPercentages[factorId] / 100;
                totalPercentage += fallbackPercentage;
                appliedFactorIds.add(factorId);
                console.warn(`[Full-Chip] Factor '${factorId}' not found in config, using fallback value: +${fallbackPercentages[factorId]}%`);
              } else {
                console.warn(`[Full-Chip] Percentage factor '${factorId}' not found in system configuration`);
              }
            } else if (factor.enabled === false) {
              console.warn(`[Full-Chip] Percentage factor '${factorId}' is disabled`);
            } else if (factor.levels && factor.levels.length > 0) {
              console.warn(`[Full-Chip] Percentage factor '${factorId}' has levels - should be handled in step 2d`);
            }
          }
        });
      } else {
        console.log(`[Full-Chip] No percentageFactors configured`);
      }

      // 2d: Handle factors with levels (dropdown selections) - INDEPENDENT and CUMULATIVE
      // CRITICAL: This includes IO Pad Count (io_pad_count), mesh/MS-CTS (clock_distribution), etc.
      // All level-based factors are processed independently and added cumulatively
      if (projectConfig.fullChip.percentageFactorLevels) {
        console.log(`[Full-Chip] Processing percentageFactorLevels:`, projectConfig.fullChip.percentageFactorLevels);
        Object.entries(projectConfig.fullChip.percentageFactorLevels).forEach(([factorId, levelId]) => {
          if (factorId === 'blocks_count') {
            return; // Already handled in 2b via fullChipBlocksTier
          }
          const factor = systemConfig.fullChip.percentage.find((f) => f.id === factorId);
          if (factor && factor.enabled !== false && factor.levels) {
            const level = factor.levels.find((l) => l.id === levelId);
            if (level) {
              // CRITICAL: Ensure percentage is a valid number and normalize it
              const levelPercentage = Number(level.resourcePercentage) || 0;
              if (levelPercentage > 0 && levelPercentage < 10000) { // Sanity check: percentage should be reasonable
                if (!appliedFactorIds.has(factorId)) {
                  // CRITICAL: All level-based factors are cumulative - IO Pads, mesh/MS-CTS, etc.
                  // Example: IO Pads High (15%) + mesh/MS-CTS Complex (30%) = 0.45 added to totalPercentage
                  const normalizedPercentage = levelPercentage / 100; // Normalize: divide by 100
                  totalPercentage += normalizedPercentage;
                  appliedFactorIds.add(factorId);
                  const displayName = factorId === 'clock_distribution' ? 'mesh/MS-CTS' : factorId;
                  console.log(`[Full-Chip] Applied level-based factor: ${displayName} (${levelId}) = ${levelPercentage}% (normalized: ${normalizedPercentage}, totalPercentage now: ${totalPercentage})`);
                }
              } else {
                if (levelPercentage >= 10000) {
                  const displayName = factorId === 'clock_distribution' ? 'mesh/MS-CTS' : factorId;
                  console.error(`[Full-Chip] ERROR: Level-based factor ${displayName} (${levelId}) has suspiciously high percentage: ${levelPercentage}% - skipping to prevent calculation error`);
                } else {
                  const displayName = factorId === 'clock_distribution' ? 'mesh/MS-CTS' : factorId;
                  console.log(`[Full-Chip] Level-based factor ${displayName} (${levelId}) has 0% percentage, skipping`);
                }
              }
            } else {
              const displayName = factorId === 'clock_distribution' ? 'mesh/MS-CTS' : factorId;
              console.warn(`[Full-Chip] Level '${levelId}' not found for factor '${displayName}'`);
            }
          } else {
            const displayName = factorId === 'clock_distribution' ? 'mesh/MS-CTS' : factorId;
            if (!factor) {
              console.warn(`[Full-Chip] Factor '${displayName}' not found in system configuration`);
            } else if (factor.enabled === false) {
              console.warn(`[Full-Chip] Factor '${displayName}' is disabled`);
            } else if (!factor.levels) {
              console.warn(`[Full-Chip] Factor '${displayName}' does not have levels`);
            }
          }
        });
      } else {
        console.log(`[Full-Chip] No percentageFactorLevels provided`);
      }

      // 2d1: Power Domains
      // None = 0%, Non-nested = 5%, Nested = 10%
      if (projectConfig.fullChip.powerDomains) {
        if (projectConfig.fullChip.powerDomains === 'non_nested') {
          totalPercentage += 0.05; // 5%
          console.log(`[Full-Chip] Power Domains (Non-nested): +5%`);
        } else if (projectConfig.fullChip.powerDomains === 'nested') {
          totalPercentage += 0.10; // 10%
          console.log(`[Full-Chip] Power Domains (Nested): +10%`);
        }
      }

      // 2e: Apply DFT - Top Level (if enabled) - INDEPENDENT of other factors
      // CRITICAL: DFT percentage is added CUMULATIVELY with all other factors
      // This step is independent - it does NOT prevent Low Power or any other factor from being applied
      // All factors are cumulative: totalPercentage = techNode + lowPower + dft + modes + ...
      if (projectConfig.fullChip.dft) {
        const dftFactorId = 'dft_top_level';
        if (!appliedFactorIds.has(dftFactorId)) {
          const dftFactor = systemConfig.fullChip.percentage.find(f => f.id === dftFactorId && f.enabled !== false);
          if (dftFactor) {
            // CRITICAL: DFT is added CUMULATIVELY - it does NOT exclude or skip other factors
            // Example: Tech (10%) + Low Power (10%) + DFT (30%) = totalPercentage = 0.50
            const dftPercentage = (Number(dftFactor.resourcePercentage) || 0) / 100;
            totalPercentage += dftPercentage;
            appliedFactorIds.add(dftFactorId);
            console.log(`[Full-Chip] Applied DFT percentage: ${dftFactor.resourcePercentage}% (totalPercentage now: ${totalPercentage})`);
          }
        }
      }

      // 2f: Apply Glue Logic scaling (if enabled) - INDEPENDENT of other factors
      // CRITICAL: Glue Logic percentage is added CUMULATIVELY with all other factors
      // Frontend sends instanceCount as: 1.5 (<1.5M), 2.5 (<2.5M), 3.5 (<3.5M), 4.5 (<4.5M)
      // Logic: <=1.5M = 2%, <=2.5M = 4%, <=3.5M = 6%, <=4.5M = 8%, >4.5M = 8% (capped)
      // Same as Full Chip Configuration and Block + Full Chip Integration
      if (projectConfig.fullChip.glueLogic === true && projectConfig.fullChip.instanceCount) {
        const instanceCount = Number(projectConfig.fullChip.instanceCount);
        let glueLogicPercentage = 2; // Default for <=1.5M

        if (instanceCount <= 1.5) {
          glueLogicPercentage = 2; // <=1.5M: 2%
        } else if (instanceCount <= 2.5) {
          glueLogicPercentage = 4; // <=2.5M: 4%
        } else if (instanceCount <= 3.5) {
          glueLogicPercentage = 6; // <=3.5M: 6%
        } else if (instanceCount <= 4.5) {
          glueLogicPercentage = 8; // <=4.5M: 8%
        } else {
          glueLogicPercentage = 8; // >4.5M: 8% (capped)
        }

        totalPercentage += glueLogicPercentage / 100;
        console.log(`[Full-Chip] Applied Glue Logic percentage: ${glueLogicPercentage}% (instanceCount=${instanceCount}M, totalPercentage now: ${totalPercentage})`);
      } else if (projectConfig.fullChip.glueLogic === true) {
        // If glueLogic is true but instanceCount is not provided, use default 2%
        totalPercentage += 2 / 100;
        console.log(`[Full-Chip] Applied Glue Logic percentage: 2% (default, instanceCount not provided, totalPercentage now: ${totalPercentage})`);
      }

      // ============================================================
      // STEP 3: Apply percentage factors to (fixed resources × base timeline effort)
      // ============================================================
      // CRITICAL: Percentage factors are applied to (fixed resources × base timeline effort)
      // Formula: finalFullChipEffort = ((PnR base + other fixed) × baseTimelineEffort) × (1 + sumOfPercentages)
      // All percentage factors are INDEPENDENT and CUMULATIVE:
      //   - Tech Node (from step 2a)
      //   - Blocks Scaling (from step 2b, if applicable)
      //   - Low Power Full Chip, Modes, Abutment Floorplan, etc. (from step 2c)
      //   - mesh/MS-CTS, IO Pads, etc. (from step 2d, if applicable)
      //   - DFT Top Level (from step 2e, if enabled)
      // Example: baseTimelineEffort = 7.0, fixedResources = 1.0 (PnR only), techNode = 10%, DFT = 30%
      //   baseEffort = 1.0 × 7.0 = 7.0
      //   totalPercentage = 0.10 + 0.30 = 0.40
      //   finalFullChipEffort = 7.0 × (1 + 0.40) = 7.0 × 1.40 = 9.80
      // CRITICAL: Ensure all values are numbers to prevent type conversion errors
      const baseEffortNum = Number(baseEffort);
      const totalPercentageNum = Number(totalPercentage);

      // CRITICAL: Sanity check - totalPercentage should be reasonable (between 0 and 10, i.e., 0% to 1000%)
      if (totalPercentageNum > 10) {
        console.error(`[Full-Chip] ERROR: totalPercentage is suspiciously high: ${totalPercentageNum} (${(totalPercentageNum * 100).toFixed(1)}%). This will cause incorrect calculation. Resetting to 0.`);
        totalPercentage = 0.0;
      }

      const fullChipEffort = baseEffortNum * (1 + totalPercentageNum);
      console.log(`[Full-Chip] Percentage scaling: baseEffort=${baseEffortNum} (timeline=${baseTimelineEffort} + fixed=${fixedResourcesSum}), totalPercentage=${totalPercentageNum.toFixed(3)} (${(totalPercentageNum * 100).toFixed(1)}%), finalEffort=${fullChipEffort.toFixed(6)}`);

      // CRITICAL: Sanity check - fullChipEffort should be reasonable
      if (fullChipEffort > 1000) {
        console.error(`[Full-Chip] ERROR: fullChipEffort is suspiciously high: ${fullChipEffort}. This indicates a calculation error.`);
      }

      // DFT effort for Full-Chip projects (for breakdown display only)
      // CRITICAL: For Full-Chip projects, DFT Top Level is treated as a PERCENTAGE FACTOR ONLY
      // It is already included in fullChipEffort via the multiplier
      // Set dftEffort = 0 to avoid double-counting
      const dftEffort = 0;

      // ============================================================
      // STEP 5: Set totalEffort = fullChipEffort (SINGLE SOURCE OF TRUTH for cost calculation)
      // ============================================================
      // For full-chip projects, totalEffort MUST equal fullChipEffort
      // CRITICAL: Keep full precision - DO NOT round before cost calculation
      const totalEffort = fullChipEffort;

      // ============================================================
      // STEP 6: Get Full Chip Duration (depends ONLY on RTL drops)
      // ============================================================
      let fullChipDuration = 0;
      if (projectConfig.fullChip.rtl_drop_count) {
        const fullChipTimeline = systemConfig.fullChipTimeline.find(
          (t) => t.rtl_drop_count === projectConfig.fullChip.rtl_drop_count,
        );
        fullChipDuration = fullChipTimeline?.months || 0;
      } else {
        const defaultTimeline = systemConfig.fullChipTimeline.find(t => t.rtl_drop_count === 3);
        fullChipDuration = defaultTimeline?.months || 0;
      }

      // ============================================================
      // STEP 7: Calculate cost using ROUNDED effort (Excel alignment)
      // ============================================================
      // CRITICAL EXCEL ALIGNMENT: Excel uses rounded effort (2 decimals) for cost calculation
      // Formula: cost = roundedEffort × costPerResourcePerMonth
      // NOTE: roundedEffort already includes timeline (baseEffort = fixedResources × baseTimelineEffort)
      // So we do NOT multiply by duration again - the timeline is already baked into the effort value
      // Excel rounds effort to 2 decimals FIRST, then uses that rounded value for cost
      // Example: baseEffort = 1.0 × 7.0 = 7.0, finalEffort = 7.0 × 1.0 = 7.0
      //          roundedEffort = 7.00, cost = 7.00 × 4,00,000 = ₹28,00,000
      // Round effort to 2 decimal places for cost calculation (matches Excel behavior)
      const roundedEffort = Number(Number(totalEffort || 0).toFixed(2));
      const finalCost = roundedEffort * systemConfig.costPerResourcePerMonth;
      console.log(`[Full-Chip] Cost calculation: rawEffort=${totalEffort.toFixed(6)}, roundedEffort=${roundedEffort}, costPerMonth=${systemConfig.costPerResourcePerMonth}, finalCost=${finalCost.toFixed(2)}`);

      // Use rounded effort for display (breakdown.totalEffort)
      // CRITICAL: This rounded value is used for BOTH cost calculation and UI display
      const displayEffort = roundedEffort;

      // ============================================================
      // RETURN: Full Chip Results (no block processing)
      // ============================================================
      // CRITICAL: Full Chip and Block projects are mutually exclusive
      // Block effort is always 0 for full-chip projects
      return {
        months: fullChipDuration,
        price: Math.round(finalCost), // Round final cost to integer (currency format)
      };
    }

    // ============================================================
    // BLOCK FLOW (Mutually Exclusive - Only when Full Chip is disabled)
    // ============================================================
    // CRITICAL: This section ONLY runs when full_chip === false
    // Full-chip effort = 0, block effort is calculated normally

    // ============================================================
    // NEW BLOCK DEVELOPMENT COST MODEL (Excel-Based)
    // ============================================================
    // Model: Block pricing based on Excel spreadsheet logic
    //
    // 1. Base Calculation:
    //    - Base resources: 0.5 (for <1.5M instance count)
    //    - Multiply by duration (months from RTL drops) to get base block value
    //    - Formula: Base Block Resources = 0.5 × Duration (months)
    //    - Example: 3 RTL drops = 7 months → 0.5 × 7 = 3.5 resources
    //
    // 2. Instance Count Scaling (if > 1.5M):
    //    - For each 1M additional gates beyond 1.5M: +10%
    //    - Formula: Extra Gates = max(0, gateCount - 1.5M)
    //    - Scaling: floor(Extra Gates / 1M) × 10%
    //
    // 3. Complexity-Driven Adders (as percentages):
    //    - Advanced node (≤7nm): +10%
    //    - New design: +20%
    //    - Power domains (non-nested): +10%, (nested): +30%
    //    - Merged mode SDC: +10%
    //    - Synthesis ownership: +5%
    //    - Macro intensive: +10%
    //    - IO included: +20%
    //    - Analog IPs included: +30%
    //    - Block-level DFT: +60% (context-based: 60-80%)
    //    - Hierarchical design: +100% (fixed per block)
    //
    // 4. Block Count Scaling (project-level):
    //    - < 9 blocks: 0%
    //    - 9-18 blocks: +10%
    //    - > 18 blocks: +20%
    //
    // Formula: 
    //   Base Block Resources = 0.5 × Duration (months from RTL drops)
    //   Example: 3 RTL drops = 7 months → 0.5 × 7 = 3.5 resources
    //   Instance Scaling = (if gateCount > 1.5M) floor((gateCount - 1.5) / 1.0) × 10%
    //   Price per Block = (Base Block Resources × (1 + Instance Scaling) × (1 + Complexity Adders)) × ₹4,00,000
    //   Total Block Project Price = (Number of Blocks × Price per Block) × (1 + Block Count Uplift)

    // ============================================================
    // STEP 1: Base Block Resources Calculation
    // ============================================================
    // Base Resource = 0.5 (ALWAYS constant)
    // Base Resources = 0.5 × Duration (months from RTL drops)
    const baseResource = systemConfig.blockGateCount.baseResource || 0.5; // 0.5 resources for base instance count (constant)
    const costPerResourcePerMonth = systemConfig.costPerResourcePerMonth; // ₹4,00,000
    console.log(`[Block] Base resource: ${baseResource}, Cost per resource-month: ₹${costPerResourcePerMonth.toFixed(2)}`);

    // ============================================================
    // STEP 2: Calculate Resources per Block (with Complexity Adders)
    // ============================================================
    let totalBlockResources = 0.0;
    let totalManMonths = 0.0; // Sum of all blocks' man months

    projectConfig.blocks.forEach((block, blockIndex) => {
      // Get complexity factors array
      const blockComplexityFactors = Array.isArray(block.complexityFactors) ? block.complexityFactors : [];

      // Validate gate count (still needed for validation, but not for cost calculation)
      const gateCount = Number(block.gateCount) || systemConfig.blockGateCount.baseGateCount;
      if (gateCount <= 0) {
        throw new BadRequestException(`Block gate count must be greater than 0. Found: ${gateCount}`);
      }
      // maxGateCount validation removed - backend accepts any gate count

      // Get RTL drops count
      const defaultRtlDropCount = 3;
      const rtlDropCount = block.rtl_drop_count || defaultRtlDropCount;

      // Get Duration (months from RTL drops) - used for calculating man months
      const blockTimeline = systemConfig.blockTimeline.find(
        (t) => t.rtl_drop_count === rtlDropCount,
      );
      const rtlDropsMonths = blockTimeline?.months || (rtlDropCount === 1 ? 2 : rtlDropCount === 2 ? 4 : 6);

      // ============================================================
      // STEP 2a: Calculate Base Resource Value (before duration multiplication)
      // ============================================================
      // Base resource constant = 0.5 (will be multiplied by duration later)
      const baseResourceValue = baseResource; // 0.5
      console.log(`[Block "${block.blockName || 'Unknown'}"] Base resource value: ${baseResourceValue}`);

      // ============================================================
      // STEP 2b: Calculate Instance Count Scaling (if > 1.5M)
      // ============================================================
      // Logic: For every 1M above 1.5M, add 10%
      // Examples:
      //   - 1.5M: 0% (base, no scaling)
      //   - 2.5M: 10% (1M above 1.5M = 1 × 10%)
      //   - 3.5M: 20% (2M above 1.5M = 2 × 10%)
      //   - 4.5M: 30% (3M above 1.5M = 3 × 10%)
      const baseGateCount = systemConfig.blockGateCount.baseGateCount; // 1.5M
      const gateIncrementStep = 1.0; // Fixed: 1M per increment (hardcoded, not configurable)
      const additionalResourcePercentage = systemConfig.blockGateCount.additionalResourcePercentage || 10; // 10% per 1M

      let instanceScalingPercentage = 0.0;
      if (gateCount > baseGateCount) {
        const extraGates = gateCount - baseGateCount;
        const extraMillions = Math.floor(extraGates / gateIncrementStep);
        instanceScalingPercentage = (extraMillions * additionalResourcePercentage) / 100; // Convert to decimal
        console.log(`[Block "${block.blockName || 'Unknown'}"] Instance scaling: gateCount=${gateCount}M, extraGates=${extraGates.toFixed(1)}M, extraMillions=${extraMillions}, scaling=${(instanceScalingPercentage * 100).toFixed(1)}%`);
      } else {
        console.log(`[Block "${block.blockName || 'Unknown'}"] Instance scaling: gateCount=${gateCount}M (≤${baseGateCount}M), no scaling applied`);
      }

      // ============================================================
      // STEP 2c: Calculate Complexity Percentage Sum
      // ============================================================
      let complexitySum = 0.0;

      // Technology Node (Advanced node ≤7nm: +10%)
      // CRITICAL: According to Excel, only 7nm and below (≤7nm) get 10%, all other nodes get 0%
      if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
        const nodeValue = projectConfig.technology.toLowerCase();
        let techNodePercentage = 0;

        // For nodes ≤7nm, use 10% uplift
        if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
          techNodePercentage = 10; // ≤7nm = +10%
          complexitySum += techNodePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Technology Node "${projectConfig.technology}" (≤7nm): +${techNodePercentage}%`);
        } else {
          // For nodes >7nm, add 0% (nothing) - per Excel specification
          techNodePercentage = 0;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Technology Node "${projectConfig.technology}" (>7nm): +0% (no technology uplift per Excel)`);
        }
      }

      // Design Maturity - Duration adjustment (not percentage)
      // New Design = +1 month, Revision = +0 months (no change)
      // This duration adjustment will be applied to rtlDropsMonths
      let designMaturityDurationAdjustment = 0.0;
      if (blockComplexityFactors.includes('new_design')) {
        designMaturityDurationAdjustment = 1.0; // +1 month
        console.log(`[Block "${block.blockName || 'Unknown'}"] Design Maturity (New Design): +1 month`);
      } else if (blockComplexityFactors.includes('revision')) {
        designMaturityDurationAdjustment = 0.0; // No change
        console.log(`[Block "${block.blockName || 'Unknown'}"] Design Maturity (Revision): +0 months (no change)`);
      }

      // Power Domains (non-nested): +10%
      const hasNonNestedLP = blockComplexityFactors.includes('low_power_non_nested');
      const hasNestedLP = blockComplexityFactors.includes('low_power_nested');
      if (hasNonNestedLP) {
        const factor = systemConfig.blockComplexity.find(f => f.id === 'low_power_non_nested');
        if (factor && factor.enabled !== false) {
          complexitySum += factor.resourcePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Power Domains (non-nested): +${factor.resourcePercentage}%`);
        }
      } else if (hasNestedLP) {
        // Nested power domains are handled separately (not in the spec, but keeping for compatibility)
        const factor = systemConfig.blockComplexity.find(f => f.id === 'low_power_nested');
        if (factor && factor.enabled !== false) {
          complexitySum += factor.resourcePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Power Domains (nested): +${factor.resourcePercentage}%`);
        }
      }

      // Merged mode SDC: +10%
      if (blockComplexityFactors.includes('merged_mode_constraints')) {
        const factor = systemConfig.blockComplexity.find(f => f.id === 'merged_mode_constraints');
        if (factor && factor.enabled !== false) {
          complexitySum += factor.resourcePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Merged mode SDC: +${factor.resourcePercentage}%`);
        }
      }

      // Synthesis ownership: +5%
      if (blockComplexityFactors.includes('synthesis_complexity')) {
        const factor = systemConfig.blockComplexity.find(f => f.id === 'synthesis_complexity');
        if (factor && factor.enabled !== false) {
          complexitySum += factor.resourcePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Synthesis ownership: +${factor.resourcePercentage}%`);
        }
      }

      // Macro intensive: +10%
      if (blockComplexityFactors.includes('macro_intensive')) {
        const factor = systemConfig.blockComplexity.find(f => f.id === 'macro_intensive');
        if (factor && factor.enabled !== false) {
          complexitySum += factor.resourcePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Macro intensive: +${factor.resourcePercentage}%`);
        }
      }

      // DFT Ownership Logic (Context-Based, FINAL):
      // | DFT | IO | Analog | DFT % (Component Only) |
      // | ❌   | ❌  | ❌      | 0%                    |
      // | ✅   | ❌  | ❌      | 60%                   |
      // | ✅   | ✅  | ❌      | 70%                   |
      // | ✅   | ❌  | ✅      | 70%                   |
      // | ✅   | ✅  | ✅      | 80%                   |
      //
      // CRITICAL: IO and Analog have their own separate 20% and 30% adders
      // The DFT % in the table is the DFT component only, capped at 80%
      // Total DFT-related uplift = DFT % + IO % (if IO present) + Analog % (if Analog present)

      const hasDFT = block.dft || blockComplexityFactors.includes('dft_block_level');
      const hasIO = blockComplexityFactors.includes('io_blocks');
      const hasAnalog = blockComplexityFactors.includes('physical_blocks');

      // Debug logging
      console.log(`[Block "${block.blockName || 'Unknown'}"] Complexity factors received:`, blockComplexityFactors);
      console.log(`[Block "${block.blockName || 'Unknown'}"] hasDFT: ${hasDFT}, hasIO: ${hasIO}, hasAnalog: ${hasAnalog}`);

      // Calculate DFT component based on context (using admin-configurable percentages)
      let dftComponentPercentage = 0;
      if (hasDFT) {
        // Get DFT context percentages from configuration (with defaults if not set)
        const dftContext = systemConfig.dftContextPercentages || {
          dftAlone: 60,
          dftWithIoOrAnalog: 70,
          dftWithIoAndAnalog: 80,
        };

        if (hasIO && hasAnalog) {
          // DFT + IO + Analog → use configured percentage
          dftComponentPercentage = dftContext.dftWithIoAndAnalog;
        } else if (hasIO || hasAnalog) {
          // DFT + IO OR DFT + Analog → use configured percentage
          dftComponentPercentage = dftContext.dftWithIoOrAnalog;
        } else {
          // DFT alone → use configured percentage
          dftComponentPercentage = dftContext.dftAlone;
        }

        complexitySum += dftComponentPercentage / 100;
        console.log(`[Block "${block.blockName || 'Unknown'}"] DFT component (context-based, configurable): +${dftComponentPercentage}%`);
      }

      // IO included: +20% (separate adder, always applied if present)
      if (hasIO) {
        const ioFactor = systemConfig.blockComplexity.find(f => f.id === 'io_blocks');
        if (ioFactor && ioFactor.enabled !== false) {
          complexitySum += ioFactor.resourcePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] IO included: +${ioFactor.resourcePercentage}%`);
        }
      }

      // Analog IPs included: +30% (separate adder, always applied if present)
      console.log(`[Block "${block.blockName || 'Unknown'}"] Checking Analog IPs: hasAnalog=${hasAnalog}`);
      if (hasAnalog) {
        const analogFactor = systemConfig.blockComplexity.find(f => f.id === 'physical_blocks');
        console.log(`[Block "${block.blockName || 'Unknown'}"] Analog factor found:`, analogFactor ? { id: analogFactor.id, enabled: analogFactor.enabled, percentage: analogFactor.resourcePercentage } : 'NOT FOUND');
        if (analogFactor && analogFactor.enabled !== false) {
          complexitySum += analogFactor.resourcePercentage / 100;
          console.log(`[Block "${block.blockName || 'Unknown'}"] Analog IPs included: +${analogFactor.resourcePercentage}% (complexitySum now: ${(complexitySum * 100).toFixed(1)}%)`);
        } else {
          console.warn(`[Block "${block.blockName || 'Unknown'}"] WARNING: Analog IPs factor not found or disabled!`);
        }
      } else {
        console.log(`[Block "${block.blockName || 'Unknown'}"] Analog IPs NOT in complexityFactors array`);
      }

      // Hierarchical design: +100% (fixed per block)
      // Flat design: 0% (no hierarchical overhead)
      // Design type is MANDATORY for Block 2+ (blockIndex >= 1)
      // Block 1 (blockIndex === 0) doesn't need design type - they build first block first
      // Check complexity factors first, then fallback to project-level isFlat flag
      const hasHierarchical = blockComplexityFactors.includes('hierarchical');
      const hasFlat = blockComplexityFactors.includes('flat') || projectConfig.isFlat;
      
      // Only validate design type for Block 2 onwards (skip Block 1)
      if (blockIndex > 0 && !hasHierarchical && !hasFlat) {
        throw new BadRequestException(
          `Block "${block.blockName || 'Unknown'}": Design type is mandatory from Block 2 onwards. Please select either 'hierarchical' or 'flat' design type.`
        );
      }
      
      if (hasHierarchical) {
        complexitySum += 1.0; // +100%
        console.log(`[Block "${block.blockName || 'Unknown'}"] Hierarchical design: +100%`);
      } else if (hasFlat) {
        // Flat design: 0% (explicitly set to 0, no addition to complexitySum)
        console.log(`[Block "${block.blockName || 'Unknown'}"] Flat design: 0% (no hierarchical overhead)`);
      }

      // ============================================================
      // STEP 2d: Calculate Total Base Resource: Base × (1 + Total Percentage)
      // ============================================================
      // Formula: Total Base = Base Resource × (1 + Instance Scaling % + All Complexity %)
      // Then: Total Resources = Total Base × Duration
      // Total Percentage = Instance Scaling % + All Complexity %
      const totalPercentage = instanceScalingPercentage + complexitySum;
      const totalBaseResource = baseResourceValue * (1 + totalPercentage);

      // ============================================================
      // STEP 2d1: Apply Design Maturity Duration Adjustment
      // ============================================================
      // Design Maturity affects duration (not percentage): Revision = 0, New Design = +1 month
      const adjustedRtlDropsMonths = rtlDropsMonths + designMaturityDurationAdjustment;
      console.log(`[Block "${block.blockName || 'Unknown'}"] Duration adjustment: ${rtlDropsMonths} months + ${designMaturityDurationAdjustment} months (Design Maturity) = ${adjustedRtlDropsMonths} months`);

      // Multiply by duration to get total resources for this block
      // Formula: Base × (1 + All Percentages) × Months
      const finalResources = totalBaseResource * adjustedRtlDropsMonths;

      console.log(`[Block "${block.blockName || 'Unknown'}"] Resource calculation:`);
      console.log(`  Base resource: ${baseResourceValue.toFixed(2)}`);
      console.log(`  Instance scaling: ${(instanceScalingPercentage * 100).toFixed(1)}%`);
      console.log(`  Complexity adders: ${(complexitySum * 100).toFixed(1)}%`);
      console.log(`  Total percentage: ${(totalPercentage * 100).toFixed(1)}%`);
      console.log(`  Total base: ${totalBaseResource.toFixed(2)}`);
      console.log(`  Total resources (× ${adjustedRtlDropsMonths} months): ${finalResources.toFixed(2)}`);

      // ============================================================
      // STEP 2e: Calculate Man Months for this Block
      // ============================================================
      // Note: finalResources already includes duration (base × (1 + percentages) × months)
      // So man months is just finalResources (not multiplied by duration again)
      const blockManMonths = finalResources; // finalResources is already resources × months
      totalManMonths += blockManMonths;

      console.log(`  Man Months: ${blockManMonths.toFixed(2)} (same as final resources, already includes duration)`);

      totalBlockResources += finalResources;
    });

    // ============================================================
    // STEP 3: Apply Block Count Scaling (Project-Level)
    // ============================================================
    const numberOfBlocks = projectConfig.blocks.length;
    let blockCountUplift = 0.0;

    if (numberOfBlocks >= 9 && numberOfBlocks <= 18) {
      blockCountUplift = 0.10; // +10%
      console.log(`[Block] Block count scaling (9-18 blocks): +10%`);
    } else if (numberOfBlocks > 18) {
      blockCountUplift = 0.20; // +20%
      console.log(`[Block] Block count scaling (>18 blocks): +20%`);
    } else {
      console.log(`[Block] Block count scaling (<9 blocks): 0%`);
    }

    // ============================================================
    // STEP 4: Apply Block Count Scaling to Resources
    // ============================================================
    const totalBlockResourcesWithUplift = totalBlockResources * (1 + blockCountUplift);
    console.log(`[Block] Total block resources (before uplift): ${totalBlockResources.toFixed(3)}`);
    console.log(`[Block] Total block resources (after uplift ${(blockCountUplift * 100).toFixed(0)}%): ${totalBlockResourcesWithUplift.toFixed(3)}`);

    // ============================================================
    // STEP 5: Calculate Final Total Block Project Price
    // ============================================================
    // Formula: Total Price = Total Resources × Cost per Resource per Month
    const totalProjectPrice = totalBlockResourcesWithUplift * costPerResourcePerMonth;
    console.log(`[Block] Total project price: ${totalBlockResourcesWithUplift.toFixed(3)} × ₹${costPerResourcePerMonth.toLocaleString('en-IN')} = ₹${Math.round(totalProjectPrice).toLocaleString('en-IN')}`);

    // ============================================================
    // STEP 6: Calculate Final Duration (Project Duration in Months)
    // ============================================================
    // The project duration is determined by the block with the longest timeline (RTL drops + Design Maturity adjustment)
    // It is NOT the sum of man-months
    // CRITICAL: Design Maturity adjustment (+1 month for new_design) must be included in duration calculation
    let maxProjectDuration = 0;

    projectConfig.blocks.forEach((block) => {
      const blockComplexityFactors = Array.isArray(block.complexityFactors) ? block.complexityFactors : [];
      const rtlDropCount = block.rtl_drop_count || 3;
      const blockTimeline = systemConfig.blockTimeline.find(
        (t) => t.rtl_drop_count === rtlDropCount,
      );
      const baseDuration = blockTimeline?.months || (rtlDropCount === 1 ? 2 : rtlDropCount === 2 ? 4 : 6);
      
      // Apply Design Maturity duration adjustment
      let designMaturityAdjustment = 0.0;
      if (blockComplexityFactors.includes('new_design')) {
        designMaturityAdjustment = 1.0; // +1 month
        console.log(`[Block Duration Calc] Block "${block.blockName || 'Unknown'}" (RTL drops: ${rtlDropCount}): Base=${baseDuration} months, Design Maturity (New Design)=+${designMaturityAdjustment} month, Adjusted=${baseDuration + designMaturityAdjustment} months`);
      } else if (blockComplexityFactors.includes('revision')) {
        designMaturityAdjustment = 0.0; // No change
        console.log(`[Block Duration Calc] Block "${block.blockName || 'Unknown'}" (RTL drops: ${rtlDropCount}): Base=${baseDuration} months, Design Maturity (Revision)=+${designMaturityAdjustment} months, Adjusted=${baseDuration + designMaturityAdjustment} months`);
      } else {
        console.log(`[Block Duration Calc] Block "${block.blockName || 'Unknown'}" (RTL drops: ${rtlDropCount}): Base=${baseDuration} months, Design Maturity=not selected, Adjusted=${baseDuration} months`);
      }
      const adjustedDuration = baseDuration + designMaturityAdjustment;
      
      if (adjustedDuration > maxProjectDuration) {
        maxProjectDuration = adjustedDuration;
        console.log(`[Block Duration Calc] New max duration: ${maxProjectDuration} months (from block "${block.blockName || 'Unknown'}")`);
      }
    });

    // ============================================================
    // BLOCK FLOW: Return Results
    // ============================================================
    console.log(`[Block Flow] Final project duration: ${maxProjectDuration} months (includes Design Maturity adjustments)`);
    return {
      months: maxProjectDuration, // Return MAX duration (months), not effort
      price: Math.round(totalProjectPrice), // Round final cost to integer (currency format)
    };
  }
}
