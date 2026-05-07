import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ProjectConfiguration, Configuration } from '../types';

/**
 * Full Chip Configuration Service
 * 
 * Separate calculation logic for Full Chip Configuration engagement scope.
 * When isFlat === false && fullChip.enabled === true && blocks.length === 0, this service handles all calculations.
 * 
 * Key characteristics:
 * - Automatically adds 1.0 resource (PnR base)
 * - Uses Full Chip timeline logic (RTL drops → months)
 * - Handles full-chip-specific parameters: Abutment Floorplan, Blocks Scaling, etc.
 * - Key difference from Flat Implementation: Includes abutment_floorplan factor (only extra factor)
 */
@Injectable()
export class FullChipConfigurationService {
  constructor(private configService: ConfigService) { }

  calculateCost(projectConfig: ProjectConfiguration): {
    months: number;
    price: number;
  } {
    console.log('[Full-Chip-Configuration] Starting Full Chip Configuration calculation');
    const systemConfig = this.configService.getConfiguration();

    // ============================================================
    // STEP 1: Get Full Chip Base Timeline (from RTL drops)
    // ============================================================
    const rtlDropCount = projectConfig.fullChip.rtl_drop_count || 3; // Default to 3 if not set
    let baseTimelineEffort = 0.0;

    const fullChipTimeline = systemConfig.fullChipTimeline.find(
      (t) => t.rtl_drop_count === rtlDropCount,
    );
    if (fullChipTimeline) {
      baseTimelineEffort = Number(fullChipTimeline.months) || 0;
    } else {
      // Fallback to default timeline for 3 RTL drops
      const defaultTimeline = systemConfig.fullChipTimeline.find(t => t.rtl_drop_count === 3);
      baseTimelineEffort = Number(defaultTimeline?.months) || 7.0;
      console.warn(`[Full-Chip-Configuration] Timeline not found for RTL drops: ${rtlDropCount}, defaulting to 3 RTL drops timeline`);
    }

    console.log(`[Full-Chip-Configuration] Base timeline effort: ${baseTimelineEffort} months (RTL drops: ${rtlDropCount})`);

    // ============================================================
    // STEP 2: Calculate Fixed Resources
    // ============================================================
    // CRITICAL: Full Chip Configuration ALWAYS includes 1.0 resource (PnR base)
    // This is automatically added - no need to select it in UI
    const fullChipBaseResource = 1.0; // PnR always included for full chip configuration
    let additionalFixedResources = 0.0;

    // Check Execution Scope for fixed resources
    // From Excel: PV = 1.0 resources, STA = 1.0 resources, IR Drop = 0.5 resources
    if (projectConfig.fullChip.factors && projectConfig.fullChip.factors.length > 0) {
      projectConfig.fullChip.factors.forEach((factorId) => {
        const normalizedFactorId = factorId.replace(/-/g, '_');
        let fixedFactor = systemConfig.fullChip.fixed.find((f) => f.id === normalizedFactorId);
        if (!fixedFactor) {
          fixedFactor = systemConfig.fullChip.fixed.find((f) => f.id === factorId);
        }

        if (fixedFactor && fixedFactor.id !== 'pnr') {
          // PnR is already included in fullChipBaseResource, so skip it
          const resourceValue = Number(fixedFactor.resources) || 0;
          additionalFixedResources += resourceValue;
          console.log(`[Full-Chip-Configuration] Added fixed resource: ${factorId} = ${resourceValue}`);
        } else if (fixedFactor && fixedFactor.id === 'pnr') {
          console.log(`[Full-Chip-Configuration] PnR factor detected but already included in base (1.0), skipping duplicate`);
        }
      });
    }

    const totalFixedResources = fullChipBaseResource + additionalFixedResources;
    console.log(`[Full-Chip-Configuration] Fixed resources: Base (${fullChipBaseResource}) + Additional (${additionalFixedResources}) = ${totalFixedResources}`);

    // ============================================================
    // STEP 3: Calculate Total Percentage from All Factors (like Block Development)
    // ============================================================
    // CRITICAL: All percentage increases are applied to resources FIRST, then multiply by timeline
    // This matches Block Development logic: resources × (1 + all percentages) → final resources → final effort
    let totalPercentage = 0.0;
    const appliedFactorIds = new Set<string>();

    // 3a: Technology Node percentage
    // According to Excel: Only 7nm and below (≤7nm) get 10%, all other nodes get 0%
    if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
      const nodeValue = projectConfig.technology.toLowerCase();
      // For nodes ≤7nm (5nm, 7nm, 3nm, 2nm), use 10% uplift
      if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
        totalPercentage += 0.10; // ≤7nm = +10%
        console.log(`[Full-Chip-Configuration] Technology Node "${projectConfig.technology}" (≤7nm): +10%`);
      } else {
        // For nodes >7nm, add 0% (nothing) - per Excel specification
        console.log(`[Full-Chip-Configuration] Technology Node "${projectConfig.technology}" (>7nm): +0% (no technology uplift per Excel)`);
      }
    }

    // 3b: Blocks Scaling
    // CRITICAL: For full-chip only mode (blocks.length === 0), use numberOfBlocks to determine scaling
    // For integration mode (blocks.length > 0), use fullChipBlocksTier
    // 9-18 blocks = 10%, 18+ blocks = 20%
    
    // Extract blocks scaling percentage for DFT multiplier calculation
    let blocksScalingPercentageForDft = 0;

    // Check if blocks_count is provided in percentageFactorLevels first
    if (projectConfig.fullChip.percentageFactorLevels?.blocks_count) {
      const blocksCountLevelId = projectConfig.fullChip.percentageFactorLevels.blocks_count;
      const blocksCountFactor = systemConfig.fullChip.percentage.find(f => f.id === 'blocks_count');
      if (blocksCountFactor && blocksCountFactor.levels) {
        const blocksCountLevel = blocksCountFactor.levels.find(l => l.id === blocksCountLevelId);
        if (blocksCountLevel) {
          const blocksCountPercentage = Number(blocksCountLevel.resourcePercentage) || 0;
          totalPercentage += blocksCountPercentage / 100;
          blocksScalingPercentageForDft = blocksCountPercentage;
          appliedFactorIds.add('blocks_count');
          console.log(`[Full-Chip-Configuration] Blocks Scaling (${blocksCountLevelId}): +${blocksCountPercentage}%`);
        }
      }
    } else if (projectConfig.fullChip.numberOfBlocks !== undefined && projectConfig.fullChip.numberOfBlocks !== null) {
      // For full-chip only mode: use numberOfBlocks to determine scaling
      const numberOfBlocks = Number(projectConfig.fullChip.numberOfBlocks);
      let blocksScalingPercentage = 0;
      let blocksCountLevelId = 'none';

      if (numberOfBlocks <= 8) {
        blocksScalingPercentage = 0; // ≤8 blocks = 0%
        blocksCountLevelId = 'none';
      } else if (numberOfBlocks >= 9 && numberOfBlocks <= 18) {
        blocksScalingPercentage = 10; // 9-18 blocks = 10%
        blocksCountLevelId = '9-18';
      } else {
        blocksScalingPercentage = 20; // >18 blocks = 20%
        blocksCountLevelId = '18-plus';
      }

      totalPercentage += blocksScalingPercentage / 100;
      blocksScalingPercentageForDft = blocksScalingPercentage;
      if (blocksScalingPercentage > 0) {
        appliedFactorIds.add('blocks_count');
      }
      console.log(`[Full-Chip-Configuration] Blocks Scaling (numberOfBlocks=${numberOfBlocks}, level=${blocksCountLevelId}): +${blocksScalingPercentage}%`);
    } else if (projectConfig.fullChip.fullChipBlocksTier && projectConfig.blocks && projectConfig.blocks.length > 0) {
      // For integration mode: use fullChipBlocksTier (existing logic)
      let blocksScalingPercentage = 0;
      if (projectConfig.fullChip.fullChipBlocksTier === '9to18') {
        blocksScalingPercentage = 10; // 9-18 blocks = 10%
      } else if (projectConfig.fullChip.fullChipBlocksTier === 'gt18') {
        blocksScalingPercentage = 20; // 18+ blocks = 20%
      }
      // lt9 = 0% (no scaling)

      totalPercentage += blocksScalingPercentage / 100;
      blocksScalingPercentageForDft = blocksScalingPercentage;
      if (blocksScalingPercentage > 0) {
        appliedFactorIds.add('blocks_count');
        console.log(`[Full-Chip-Configuration] Blocks Scaling (${projectConfig.fullChip.fullChipBlocksTier}): +${blocksScalingPercentage}%`);
      } else {
        console.log(`[Full-Chip-Configuration] Blocks Scaling (${projectConfig.fullChip.fullChipBlocksTier}): +0% (no scaling)`);
      }
    }

    // 3c: IO Complexity (from percentageFactorLevels)
    // Low: <50 pads = 0%, Medium: 50-150 pads = 10%, High: >150 pads = 15%
    if (projectConfig.fullChip.percentageFactorLevels?.io_pad_count) {
      const ioLevelId = projectConfig.fullChip.percentageFactorLevels.io_pad_count;
      const ioFactor = systemConfig.fullChip.percentage.find(f => f.id === 'io_pad_count');
      if (ioFactor && ioFactor.levels) {
        const ioLevel = ioFactor.levels.find(l => l.id === ioLevelId);
        if (ioLevel) {
          const ioPercentage = Number(ioLevel.resourcePercentage) || 0;
          totalPercentage += ioPercentage / 100;
          console.log(`[Full-Chip-Configuration] IO Complexity (${ioLevelId}): +${ioPercentage}%`);
        }
      }
    }

    // 3c1: Power Domains
    // None = 0%, Non-nested = 5%, Nested = 10%
    if (projectConfig.fullChip.powerDomains) {
      if (projectConfig.fullChip.powerDomains === 'non_nested') {
        totalPercentage += 0.05; // 5%
        console.log(`[Full-Chip-Configuration] Power Domains (Non-nested): +5%`);
      } else if (projectConfig.fullChip.powerDomains === 'nested') {
        totalPercentage += 0.10; // 10%
        console.log(`[Full-Chip-Configuration] Power Domains (Nested): +10%`);
      }
    }

    // 3c2: Design Maturity - Duration adjustment (not percentage)
    // Revision = 0 months (no change), New Design = +1 month
    // This duration adjustment will be applied to baseTimelineEffort
    let designMaturityDurationAdjustment = 0.0;
    if (projectConfig.fullChip.designMaturity === 'new_design') {
      designMaturityDurationAdjustment = 1.0; // +1 month
      console.log(`[Full-Chip-Configuration] Design Maturity (New Design): +1 month`);
    } else if (projectConfig.fullChip.designMaturity === 'revision') {
      designMaturityDurationAdjustment = 0.0; // No change
      console.log(`[Full-Chip-Configuration] Design Maturity (Revision): +0 months (no change)`);
    }

    // 3c3: Glue Logic
    // Frontend sends instanceCount as: 1.5 (<1.5M), 2.5 (<2.5M), 3.5 (<3.5M), 4.5 (<4.5M)
    // Logic: <=1.5M = 2%, <=2.5M = 4%, <=3.5M = 6%, <=4.5M = 8%, >4.5M = 8% (capped)
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
      console.log(`[Full-Chip-Configuration] Glue Logic: +${glueLogicPercentage}% (instanceCount=${instanceCount}M)`);
    } else if (projectConfig.fullChip.glueLogic === true) {
      totalPercentage += 0.02; // Default 2%
      console.log(`[Full-Chip-Configuration] Glue Logic: +2% (default, instanceCount not provided)`);
    }

    // 3d: Execution Scope - Percentage Factors
    // KEY DIFFERENCE FROM FLAT: Includes abutment_floorplan (NOT skipped like in Flat Implementation)
    // From Excel: Abutment Floorplan = 10%, Analog IP Integration = 10%, Modes = 10%
    // NOTE: Low Power - Full Chip is NOT available for Full Chip Configuration (same as Flat Implementation)
    if (projectConfig.fullChip.percentageFactors && projectConfig.fullChip.percentageFactors.length > 0) {
      console.log(`[Full-Chip-Configuration] Processing percentageFactors: ${projectConfig.fullChip.percentageFactors.join(', ')}`);
      projectConfig.fullChip.percentageFactors.forEach((factorId) => {
        console.log(`[Full-Chip-Configuration] Processing factor: ${factorId}`);
        // Skip DFT - handled separately
        if (factorId === 'dft_top_level') {
          return;
        }
        // Skip Blocks Scaling - handled separately in step 3b
        if (factorId === 'blocks_count') {
          return;
        }
        // Skip Low Power - Full Chip - not available for Full Chip Configuration (same as Flat Implementation)
        if (factorId === 'low_power_full_chip') {
          console.log(`[Full-Chip-Configuration] Skipping low_power_full_chip - not available for Full Chip Configuration`);
          return;
        }
        // Skip mesh/MS-CTS (clock_distribution) - has levels, handled in step 3f
        if (factorId === 'clock_distribution') {
          console.log(`[Full-Chip-Configuration] Skipping clock_distribution from percentageFactors - has levels, handled separately`);
          return;
        }

        // KEY DIFFERENCE: Include abutment_floorplan (NOT skipped like in Flat Implementation)
        const factor = systemConfig.fullChip.percentage.find(f => f.id === factorId && f.enabled !== false);
        if (factor && !factor.levels && !appliedFactorIds.has(factorId)) {
          const factorPercentage = (Number(factor.resourcePercentage) || 0) / 100;
          if (factorPercentage > 0) {
            totalPercentage += factorPercentage;
            appliedFactorIds.add(factorId);
            console.log(`[Full-Chip-Configuration] Execution Scope factor (${factorId}): +${factor.resourcePercentage}%`);
          } else {
            console.warn(`[Full-Chip-Configuration] Factor '${factorId}' found but resourcePercentage is 0 or invalid`);
          }
        } else if (!factor) {
          console.log(`[Full-Chip-Configuration] Factor '${factorId}' not found in config, checking fallback...`);
          // Fallback: Use expected values for known factors if not in config
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
            console.warn(`[Full-Chip-Configuration] Factor '${factorId}' not found in config, using fallback value: +${fallbackPercentages[factorId]}%`);
          } else {
            console.warn(`[Full-Chip-Configuration] Factor '${factorId}' not found in Full Chip Configuration percentage config. Available factors: ${systemConfig.fullChip.percentage.map(f => f.id).join(', ')}`);
          }
        } else if (factor && factor.levels) {
          console.log(`[Full-Chip-Configuration] Factor '${factorId}' has levels - should be in percentageFactorLevels, not percentageFactors`);
        } else if (factor && appliedFactorIds.has(factorId)) {
          console.log(`[Full-Chip-Configuration] Factor '${factorId}' already applied, skipping duplicate`);
        } else if (factor && factor.enabled === false) {
          console.log(`[Full-Chip-Configuration] Factor '${factorId}' is disabled, skipping`);
        } else {
          console.warn(`[Full-Chip-Configuration] Factor '${factorId}' - unexpected condition, factor found: ${!!factor}, has levels: ${factor?.levels ? 'yes' : 'no'}, already applied: ${appliedFactorIds.has(factorId)}`);
        }
      });
    }

    // 3e: Check for Synthesis in fixed factors (PnR) - if PnR is selected, also add Synthesis percentage
    // Frontend sends Synthesis as 'pnr' in factors, but we need to add synthesis_full_chip percentage
    if (projectConfig.fullChip.factors && projectConfig.fullChip.factors.includes('pnr')) {
      const synthesisFactor = systemConfig.fullChip.percentage.find(f => f.id === 'synthesis_full_chip' && f.enabled !== false);
      if (synthesisFactor && !appliedFactorIds.has('synthesis_full_chip')) {
        const synthesisPercentage = (Number(synthesisFactor.resourcePercentage) || 0) / 100;
        totalPercentage += synthesisPercentage;
        appliedFactorIds.add('synthesis_full_chip');
        console.log(`[Full-Chip-Configuration] Synthesis (from PnR factor): +${synthesisFactor.resourcePercentage}%`);
      } else if (!synthesisFactor) {
        // Fallback if synthesis_full_chip not found in config
        if (!appliedFactorIds.has('synthesis_full_chip')) {
          totalPercentage += 0.05; // 5% fallback
          appliedFactorIds.add('synthesis_full_chip');
          console.warn(`[Full-Chip-Configuration] Synthesis factor not found in config, using fallback value: +5%`);
        }
      } else if (appliedFactorIds.has('synthesis_full_chip')) {
        console.log(`[Full-Chip-Configuration] Synthesis already applied, skipping duplicate`);
      }
    }

    // 3f: Clock Distribution (clock_distribution) - from percentageFactorLevels OR percentageFactors
    // Clock Distribution (Complex: Mesh/Multi-source) = 30%
    // Frontend may send it in percentageFactors
    if (projectConfig.fullChip.percentageFactorLevels?.clock_distribution) {
      const clockLevelId = projectConfig.fullChip.percentageFactorLevels.clock_distribution;
      const clockFactor = systemConfig.fullChip.percentage.find(f => f.id === 'clock_distribution');
      if (clockFactor && clockFactor.levels) {
        const clockLevel = clockFactor.levels.find(l => l.id === clockLevelId);
        if (clockLevel) {
          const clockPercentage = Number(clockLevel.resourcePercentage) || 0;
          totalPercentage += clockPercentage / 100;
          appliedFactorIds.add('clock_distribution');
          console.log(`[Full-Chip-Configuration] mesh/MS-CTS (${clockLevelId}): +${clockPercentage}%`);
        }
      }
    } else if (projectConfig.fullChip.percentageFactors && projectConfig.fullChip.percentageFactors.includes('clock_distribution')) {
      // Frontend sends mesh/MS-CTS in percentageFactors - treat as complex/mesh (30%)
      const clockFactor = systemConfig.fullChip.percentage.find(f => f.id === 'clock_distribution' && f.enabled !== false);
      if (clockFactor && !appliedFactorIds.has('clock_distribution')) {
        // Use the base resourcePercentage (30%) since no level is specified
        const clockPercentage = Number(clockFactor.resourcePercentage) || 0;
        if (clockPercentage > 0) {
          totalPercentage += clockPercentage / 100;
          appliedFactorIds.add('clock_distribution');
          console.log(`[Full-Chip-Configuration] mesh/MS-CTS (from percentageFactors): +${clockPercentage}%`);
        } else {
          console.warn(`[Full-Chip-Configuration] mesh/MS-CTS factor found but resourcePercentage is 0 or invalid`);
        }
      } else if (!clockFactor) {
        console.warn(`[Full-Chip-Configuration] Clock Distribution factor not found in Full Chip Configuration percentage config`);
      }
    }

    // 3g: DFT - Top Level (if enabled) - REMOVED from percentage calculation
    // DFT is now handled as a fixed resource (1.0) added after complexity factors
    // This is done in STEP 4 after totalBaseResource is calculated

    console.log(`[Full-Chip-Configuration] Total percentage: ${(totalPercentage * 100).toFixed(1)}%`);

    // ============================================================
    // STEP 4: Calculate Total Base Resource
    // ============================================================
    // FORMULA: Base × (1 + complexity percentage) = x, then x + DFT = y, then y × duration = final
    // Base includes: PnR (1.0) + Fixed Resources (IR Drop, STA, PV)
    const baseResourceValue = fullChipBaseResource; // 1.0 (PnR base)
    const additionalFixedValue = additionalFixedResources; // Fixed resources (PV, STA, IR Drop)

    // Base = PnR + Fixed Resources
    const base = baseResourceValue + additionalFixedValue;

    // x = Base × (1 + totalPercentage)
    const resourcesAfterComplexity = base * (1 + totalPercentage);

    // y = x + DFT (if enabled)
    // CRITICAL: DFT resource is multiplied by (1 + techNode% + blocks%) - percentages are ADDED, not multiplied
    let resourcesAfterDft = resourcesAfterComplexity;
    if (projectConfig.fullChip.dft) {
      const dftBaseResource = 1.0;
      
      // Get technology node percentage to add with DFT
      // According to Excel: Only 7nm and below (≤7nm) get 10%, all other nodes get 0%
      let techNodePercentage = 0.0; // Default: no percentage (0%)
      if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
        const nodeValue = projectConfig.technology.toLowerCase();
        if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
          techNodePercentage = 10 / 100; // ≤7nm: 10%
        } else {
          // For nodes >7nm, percentage = 0% (no increase) - per Excel specification
          techNodePercentage = 0.0;
        }
      }
      
      // Get blocks percentage to add with DFT
      // blocksScalingPercentageForDft is already a percentage (10, 20, or 0)
      const blocksPercentage = blocksScalingPercentageForDft / 100;
      
      // DFT = 1.0 × (1 + techNode% + blocks%)
      // Example: If techNode = 10% and blocks = 10%, then DFT = 1.0 × (1 + 0.10 + 0.10) = 1.0 × 1.20 = 1.20
      const dftFixedResource = dftBaseResource * (1.0 + techNodePercentage + blocksPercentage);
      resourcesAfterDft = resourcesAfterComplexity + dftFixedResource;
      const totalPercentageForDft = (techNodePercentage + blocksPercentage) * 100;
      console.log(`[Full-Chip-Configuration] DFT Top Level: ${dftBaseResource} × (1 + ${(techNodePercentage * 100).toFixed(0)}% tech node + ${blocksScalingPercentageForDft.toFixed(0)}% blocks) = ${dftBaseResource} × (1 + ${totalPercentageForDft.toFixed(0)}%) = ${dftFixedResource.toFixed(2)} resource`);
    }

    console.log(`[Full-Chip-Configuration] Resource calculation:`);
    console.log(`  Base resource (PnR): ${baseResourceValue.toFixed(2)}`);
    console.log(`  Additional fixed resources: ${additionalFixedValue.toFixed(2)}`);
    console.log(`  Base (PnR + Fixed): ${base.toFixed(2)}`);
    console.log(`  Complexity percentage: ${(totalPercentage * 100).toFixed(1)}%`);
    console.log(`  Resources after complexity: ${base.toFixed(2)} × (1 + ${totalPercentage.toFixed(2)}) = ${resourcesAfterComplexity.toFixed(2)}`);
    if (projectConfig.fullChip.dft) {
      const dftBaseResource = 1.0;
      let techNodePercentage = 0.0;
      if (projectConfig.technology && systemConfig.technologyNodeMultipliers) {
        const nodeValue = projectConfig.technology.toLowerCase();
        if (nodeValue === '5nm' || nodeValue === '7nm' || nodeValue === '3nm' || nodeValue === '2nm') {
          techNodePercentage = 10 / 100;
        } else {
          // For nodes >7nm, percentage = 0% (no increase) - per Excel specification
          techNodePercentage = 0.0;
        }
      }
      const blocksPercentage = blocksScalingPercentageForDft / 100;
      const dftFixedResource = dftBaseResource * (1.0 + techNodePercentage + blocksPercentage);
      const totalPercentageForDft = (techNodePercentage + blocksPercentage) * 100;
      console.log(`  DFT (fixed resource): +${dftFixedResource.toFixed(2)} (${dftBaseResource} × (1 + ${totalPercentageForDft.toFixed(0)}%))`);
    }
    console.log(`  Total base (after DFT): ${resourcesAfterDft.toFixed(2)}`);

    // Use resourcesAfterDft as totalBaseResource for duration multiplication
    const totalBaseResource = resourcesAfterDft;

    // ============================================================
    // STEP 4.5: Apply Design Maturity Duration Adjustment
    // ============================================================
    // Design Maturity affects duration (not percentage): Revision = 0, New Design = +1 month
    const adjustedBaseTimelineEffort = baseTimelineEffort + designMaturityDurationAdjustment;
    console.log(`[Full-Chip-Configuration] Duration adjustment: ${baseTimelineEffort} months + ${designMaturityDurationAdjustment} months (Design Maturity) = ${adjustedBaseTimelineEffort} months`);

    // ============================================================
    // STEP 5: Multiply by Duration to Get Total Resources
    // ============================================================
    // Formula: Total Resources = Total Base × Duration
    const finalResources = totalBaseResource * adjustedBaseTimelineEffort;
    console.log(`[Full-Chip-Configuration] Total resources: ${totalBaseResource.toFixed(2)} × ${adjustedBaseTimelineEffort} months = ${finalResources.toFixed(2)}`);

    // ============================================================
    // STEP 6: Calculate Cost
    // ============================================================
    // Formula: cost = finalResources × costPerResourcePerMonth
    const roundedResources = Number(Number(finalResources || 0).toFixed(2));
    const finalCost = roundedResources * systemConfig.costPerResourcePerMonth;
    console.log(`[Full-Chip-Configuration] Cost: ${roundedResources} × ${systemConfig.costPerResourcePerMonth} = ₹${finalCost.toFixed(2)}`);

    // ============================================================
    // STEP 7: Get Duration (for return value)
    // ============================================================
    // CRITICAL: Always return the adjusted duration (base timeline + Design Maturity adjustment)
    // The Design Maturity adjustment (+1 month for new_design, +0 for revision) is ALWAYS applied
    // even if the base timeline is already at maximum months
    const fullChipDuration = adjustedBaseTimelineEffort;
    console.log(`[Full-Chip-Configuration] Final duration to return: ${fullChipDuration} months (base: ${baseTimelineEffort} months + Design Maturity: ${designMaturityDurationAdjustment} months)`);

    return {
      months: fullChipDuration,
      price: Math.round(finalCost),
    };
  }
}
