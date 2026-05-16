import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ProjectConfiguration, Configuration } from '../types';

/**
 * Flat Implementation Service
 * 
 * Separate calculation logic for Flat Implementation engagement scope.
 * When isFlat === true, this service handles all calculations.
 * 
 * Key characteristics:
 * - Automatically adds 1.0 resource (PnR base)
 * - Uses Flat Implementation timeline logic (RTL drops → months)
 * - Handles flat-specific parameters: IO complexity, Power Domains, Design Maturity, Glue Logic, Execution Scope
 */
@Injectable()
export class FlatImplementationService {
  constructor(private configService: ConfigService) {}

  calculateCost(projectConfig: ProjectConfiguration): {
    months: number;
    price: number;
  } {
    console.log('[Flat-Implementation] Starting Flat Implementation calculation');
    const systemConfig = this.configService.getConfiguration();

    // ============================================================
    // STEP 1: Get Flat Implementation Base Timeline (from RTL drops)
    // ============================================================
    const rtlDropCount = projectConfig.fullChip.rtl_drop_count || 3; // Default to 3 if not set
    let baseTimelineEffort = 0.0;

    const flatTimeline = systemConfig.fullChipTimeline.find(
      (t) => t.rtl_drop_count === rtlDropCount,
    );
    if (flatTimeline) {
      baseTimelineEffort = Number(flatTimeline.months) || 0;
    } else {
      // Fallback to default timeline for 3 RTL drops
      const defaultTimeline = systemConfig.fullChipTimeline.find(t => t.rtl_drop_count === 3);
      baseTimelineEffort = Number(defaultTimeline?.months) || 7.0;
      console.warn(`[Flat-Implementation] Timeline not found for RTL drops: ${rtlDropCount}, defaulting to 3 RTL drops timeline`);
    }

    console.log(`[Flat-Implementation] Base timeline effort: ${baseTimelineEffort} months (RTL drops: ${rtlDropCount})`);

    // ============================================================
    // STEP 2: Calculate Fixed Resources
    // ============================================================
    // CRITICAL: Flat Implementation ALWAYS includes 1.0 resource (PnR base)
    // This is automatically added - no need to select it in UI
    const flatBaseResource = 1.0; // PnR always included for flat implementation
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
          // PnR is already included in flatBaseResource, so skip it
          const resourceValue = Number(fixedFactor.resources) || 0;
          additionalFixedResources += resourceValue;
          console.log(`[Flat-Implementation] Added fixed resource: ${factorId} = ${resourceValue}`);
        } else if (fixedFactor && fixedFactor.id === 'pnr') {
          console.log(`[Flat-Implementation] PnR factor detected but already included in base (1.0), skipping duplicate`);
        }
      });
    }

    const totalFixedResources = flatBaseResource + additionalFixedResources;
    console.log(`[Flat-Implementation] Fixed resources: Base (${flatBaseResource}) + Additional (${additionalFixedResources}) = ${totalFixedResources}`);

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
        console.log(`[Flat-Implementation] Technology Node "${projectConfig.technology}" (≤7nm): +10%`);
      } else {
        // For nodes >7nm, add 0% (nothing) - per Excel specification
        console.log(`[Flat-Implementation] Technology Node "${projectConfig.technology}" (>7nm): +0% (no technology uplift per Excel)`);
      }
    }

    // 3b: IO Complexity (from percentageFactorLevels)
    // Low: <50 pads = 0%, Medium: 50-150 pads = 10%, High: >150 pads = 15%
    if (projectConfig.fullChip.percentageFactorLevels?.io_pad_count) {
      const ioLevelId = projectConfig.fullChip.percentageFactorLevels.io_pad_count;
      const ioFactor = systemConfig.fullChip.percentage.find(f => f.id === 'io_pad_count');
      if (ioFactor && ioFactor.levels) {
        const ioLevel = ioFactor.levels.find(l => l.id === ioLevelId);
        if (ioLevel) {
          const ioPercentage = Number(ioLevel.resourcePercentage) || 0;
          totalPercentage += ioPercentage / 100;
          console.log(`[Flat-Implementation] IO Complexity (${ioLevelId}): +${ioPercentage}%`);
        }
      }
    }

    // 3c: Power Domains
    // None = 0%, Non-nested = 5%, Nested = 10%
    if (projectConfig.fullChip.powerDomains) {
      if (projectConfig.fullChip.powerDomains === 'non_nested') {
        totalPercentage += 0.05; // 5%
        console.log(`[Flat-Implementation] Power Domains (Non-nested): +5%`);
      } else if (projectConfig.fullChip.powerDomains === 'nested') {
        totalPercentage += 0.10; // 10%
        console.log(`[Flat-Implementation] Power Domains (Nested): +10%`);
      }
    }

    // 3d: Design Maturity - Duration adjustment (not percentage)
    // Revision = 0 months (no change), New Design = +1 month
    // This duration adjustment will be applied to baseTimelineEffort
    let designMaturityDurationAdjustment = 0.0;
    if (projectConfig.fullChip.designMaturity === 'new_design') {
      designMaturityDurationAdjustment = 1.0; // +1 month
      console.log(`[Flat-Implementation] Design Maturity (New Design): +1 month`);
    } else if (projectConfig.fullChip.designMaturity === 'revision') {
      designMaturityDurationAdjustment = 0.0; // No change
      console.log(`[Flat-Implementation] Design Maturity (Revision): +0 months (no change)`);
    }

    // 3e: Glue Logic
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
      console.log(`[Flat-Implementation] Glue Logic: +${glueLogicPercentage}% (instanceCount=${instanceCount}M)`);
    } else if (projectConfig.fullChip.glueLogic === true) {
      totalPercentage += 0.02; // Default 2%
      console.log(`[Flat-Implementation] Glue Logic: +2% (default, instanceCount not provided)`);
    }

    // 3f: Execution Scope - Percentage Factors
    // From Excel: Synthesis = 5%, Analog IP Integration = 10%, Modes = 10%, IR Drop Analysis = included in fixed factors
    // NOTE: Low Power - Full Chip is NOT available for Flat Implementation (only for Full Chip Configuration)
    // NOTE: Abutment Floorplan is NOT available for Flat Implementation (only for Full Chip Configuration)
    // NOTE: Clock Distribution (clock_distribution) is handled in step 3g, not here
    if (projectConfig.fullChip.percentageFactors && projectConfig.fullChip.percentageFactors.length > 0) {
      console.log(`[Flat-Implementation] Processing percentageFactors: ${projectConfig.fullChip.percentageFactors.join(', ')}`);
      projectConfig.fullChip.percentageFactors.forEach((factorId) => {
        console.log(`[Flat-Implementation] Processing factor: ${factorId}`);
        // Skip DFT - handled separately
        if (factorId === 'dft_top_level') {
          return;
        }
        // Skip Abutment Floorplan - not available for Flat Implementation
        if (factorId === 'abutment_floorplan') {
          console.log(`[Flat-Implementation] Skipping abutment_floorplan - not available for Flat Implementation`);
          return;
        }
        // Skip Low Power - Full Chip - not available for Flat Implementation (only for Full Chip Configuration)
        if (factorId === 'low_power_full_chip') {
          console.log(`[Flat-Implementation] Skipping low_power_full_chip - not available for Flat Implementation`);
          return;
        }
        // Skip mesh/MS-CTS (clock_distribution) - has levels, handled in step 3g
        if (factorId === 'clock_distribution') {
          console.log(`[Flat-Implementation] Skipping mesh/MS-CTS from percentageFactors - has levels, handled separately`);
          return;
        }

        const factor = systemConfig.fullChip.percentage.find(f => f.id === factorId && f.enabled !== false);
        if (factor && !factor.levels && !appliedFactorIds.has(factorId)) {
          const factorPercentage = (Number(factor.resourcePercentage) || 0) / 100;
          if (factorPercentage > 0) {
            totalPercentage += factorPercentage;
            appliedFactorIds.add(factorId);
            console.log(`[Flat-Implementation] Execution Scope factor (${factorId}): +${factor.resourcePercentage}%`);
          } else {
            console.warn(`[Flat-Implementation] Factor '${factorId}' found but resourcePercentage is 0 or invalid (value: ${factor.resourcePercentage})`);
          }
        } else if (!factor) {
          console.log(`[Flat-Implementation] Factor '${factorId}' not found in config, checking fallback...`);
          // Fallback: Use expected values for known factors if not in config
          // This ensures calculation works even if factors are missing from database
          const fallbackPercentages: Record<string, number> = {
            'merged_mode_constraints': 10,
            'analog_ip_integration': 10,
            'macro_intensive': 10,
            'modes': 10,
          };
          if (fallbackPercentages[factorId] && !appliedFactorIds.has(factorId)) {
            const fallbackPercentage = fallbackPercentages[factorId] / 100;
            totalPercentage += fallbackPercentage;
            appliedFactorIds.add(factorId);
            console.warn(`[Flat-Implementation] Factor '${factorId}' not found in config, using fallback value: +${fallbackPercentages[factorId]}%`);
          } else {
            console.warn(`[Flat-Implementation] Factor '${factorId}' not found in Flat Implementation percentage config. Available factors: ${systemConfig.fullChip.percentage.map(f => f.id).join(', ')}`);
          }
        } else if (factor && factor.levels) {
          console.log(`[Flat-Implementation] Factor '${factorId}' has levels - should be in percentageFactorLevels, not percentageFactors`);
        } else if (factor && appliedFactorIds.has(factorId)) {
          console.warn(`[Flat-Implementation] Factor '${factorId}' already applied, skipping duplicate`);
        } else if (factor && factor.enabled === false) {
          console.warn(`[Flat-Implementation] Factor '${factorId}' is disabled, skipping`);
        } else {
          console.warn(`[Flat-Implementation] Factor '${factorId}' - unexpected condition, factor found: ${!!factor}, has levels: ${factor?.levels ? 'yes' : 'no'}, already applied: ${appliedFactorIds.has(factorId)}, enabled: ${factor?.enabled}`);
        }
      });
    }

    // 3f1: Check for Synthesis in fixed factors (PnR) - if PnR is selected, also add Synthesis percentage
    // Frontend sends Synthesis as 'pnr' in factors, but we need to add synthesis_full_chip percentage
    if (projectConfig.fullChip.factors && projectConfig.fullChip.factors.includes('pnr')) {
      const synthesisFactor = systemConfig.fullChip.percentage.find(f => f.id === 'synthesis_full_chip' && f.enabled !== false);
      if (synthesisFactor && !appliedFactorIds.has('synthesis_full_chip')) {
        const synthesisPercentage = (Number(synthesisFactor.resourcePercentage) || 0) / 100;
        totalPercentage += synthesisPercentage;
        appliedFactorIds.add('synthesis_full_chip');
        console.log(`[Flat-Implementation] Synthesis (from PnR factor): +${synthesisFactor.resourcePercentage}%`);
      } else if (!synthesisFactor) {
        // Fallback if synthesis_full_chip not found in config
        if (!appliedFactorIds.has('synthesis_full_chip')) {
          totalPercentage += 0.05; // 5% fallback
          appliedFactorIds.add('synthesis_full_chip');
          console.warn(`[Flat-Implementation] Synthesis factor not found in config, using fallback value: +5%`);
        }
      } else if (appliedFactorIds.has('synthesis_full_chip')) {
        console.log(`[Flat-Implementation] Synthesis already applied, skipping duplicate`);
      }
    }

    // 3g: Clock Distribution (clock_distribution) - from percentageFactorLevels OR percentageFactors
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
          console.log(`[Flat-Implementation] mesh/MS-CTS (${clockLevelId}): +${clockPercentage}%`);
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
          console.log(`[Flat-Implementation] mesh/MS-CTS (from percentageFactors): +${clockPercentage}%`);
        } else {
          console.warn(`[Flat-Implementation] mesh/MS-CTS factor found but resourcePercentage is 0 or invalid`);
        }
      } else if (!clockFactor) {
        console.warn(`[Flat-Implementation] Clock Distribution factor not found in Flat Implementation percentage config`);
      }
    }

    // 3h: DFT - Top Level (if enabled) - REMOVED from percentage calculation
    // DFT is now handled as a fixed resource (1.0) added after complexity factors
    // This is done in STEP 4 after totalBaseResource is calculated

    // 3i: Blocks Scaling - NOT APPLICABLE for Flat Implementation
    // Flat Implementation has NO blocks, so blocks scaling should not be applied
    // Note: fullChipBlocksTier is ignored for flat implementation

    console.log(`[Flat-Implementation] Total percentage: ${(totalPercentage * 100).toFixed(1)}%`);

    // ============================================================
    // STEP 4: Calculate Total Base Resource
    // ============================================================
    // FORMULA: Base × (1 + complexity percentage) = x, then x + DFT = y, then y × duration = final
    // Base includes: PnR (1.0) + Fixed Resources (IR Drop, STA, PV)
    const baseResourceValue = flatBaseResource; // 1.0 (PnR base)
    const additionalFixedValue = additionalFixedResources; // Fixed resources (PV, STA, IR Drop)
    
    // Base = PnR + Fixed Resources
    const base = baseResourceValue + additionalFixedValue;
    
    // x = Base × (1 + totalPercentage)
    const resourcesAfterComplexity = base * (1 + totalPercentage);
    
    // y = x + DFT (if enabled)
    // CRITICAL: DFT resource is multiplied by technology node multiplier
    let resourcesAfterDft = resourcesAfterComplexity;
    if (projectConfig.fullChip.dft) {
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
      resourcesAfterDft = resourcesAfterComplexity + dftFixedResource;
      console.log(`[Flat-Implementation] DFT Top Level: ${dftBaseResource} × ${techNodeMultiplier.toFixed(2)} (tech node) = ${dftFixedResource.toFixed(2)} resource`);
    }
    
    console.log(`[Flat-Implementation] Resource calculation:`);
    console.log(`  Base resource (PnR): ${baseResourceValue.toFixed(2)}`);
    console.log(`  Additional fixed resources: ${additionalFixedValue.toFixed(2)}`);
    console.log(`  Base (PnR + Fixed): ${base.toFixed(2)}`);
    console.log(`  Complexity percentage: ${(totalPercentage * 100).toFixed(1)}%`);
    console.log(`  Resources after complexity: ${base.toFixed(2)} × (1 + ${totalPercentage.toFixed(2)}) = ${resourcesAfterComplexity.toFixed(2)}`);
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
      console.log(`  DFT (fixed resource): +${dftFixedResource.toFixed(2)} (${dftBaseResource} × ${techNodeMultiplier.toFixed(2)} tech node)`);
    }
    console.log(`  Total base (after DFT): ${resourcesAfterDft.toFixed(2)}`);

    // Use resourcesAfterDft as totalBaseResource for duration multiplication
    const totalBaseResource = resourcesAfterDft;

    // ============================================================
    // STEP 4.5: Apply Design Maturity Duration Adjustment
    // ============================================================
    // Design Maturity affects duration (not percentage): Revision = 0, New Design = +1 month
    const adjustedBaseTimelineEffort = baseTimelineEffort + designMaturityDurationAdjustment;
    console.log(`[Flat-Implementation] Duration adjustment: ${baseTimelineEffort} months + ${designMaturityDurationAdjustment} months (Design Maturity) = ${adjustedBaseTimelineEffort} months`);

    // ============================================================
    // STEP 5: Multiply by Duration to Get Total Resources
    // ============================================================
    // Formula: Total Resources = Total Base × Duration
    const finalResources = totalBaseResource * adjustedBaseTimelineEffort;
    console.log(`[Flat-Implementation] Total resources: ${totalBaseResource.toFixed(2)} × ${adjustedBaseTimelineEffort} months = ${finalResources.toFixed(2)}`);

    // ============================================================
    // STEP 6: Calculate Cost
    // ============================================================
    // Formula: cost = finalResources × costPerResourcePerMonth
    const roundedResources = Number(Number(finalResources || 0).toFixed(2));
    const finalCost = roundedResources * systemConfig.costPerResourcePerMonth;
    console.log(`[Flat-Implementation] Cost: ${roundedResources} × ${systemConfig.costPerResourcePerMonth} = ₹${finalCost.toFixed(2)}`);

    // ============================================================
    // STEP 7: Get Duration (for return value)
    // ============================================================
    // CRITICAL: Always return the adjusted duration (base timeline + Design Maturity adjustment)
    // The Design Maturity adjustment (+1 month for new_design, +0 for revision) is ALWAYS applied
    // even if the base timeline is already at maximum months
    const flatDuration = adjustedBaseTimelineEffort;
    console.log(`[Flat-Implementation] Final duration to return: ${flatDuration} months (base: ${baseTimelineEffort} months + Design Maturity: ${designMaturityDurationAdjustment} months)`);

    return {
      months: flatDuration,
      price: Math.round(finalCost),
    };
  }
}
