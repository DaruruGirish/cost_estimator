# Parameter Coverage Comparison: Spreadsheet vs Implementation

## ✅ COVERED PARAMETERS

### 1. Block Project Timeline
- ✅ 3 RTL Drops → 6 months
- ✅ 2 RTL Drops → 4 months  
- ✅ 1 RTL Drop → 2 months

### 2. Full Chip Project Timeline
- ✅ 3 RTL Drops → 7 months
- ✅ 2 RTL Drops → 5 months
- ✅ 1 RTL Drop → 3 months

### 3. Block Gate Count
- ✅ Default: 1.5M Instance → 0.5 resources
- ✅ Additional: Per 1M → 10%
- ✅ Max: 4M

### 4. Block Complexity - Most Covered
- ✅ Constraints Development: 10%
- ✅ Synthesis: 5%
- ✅ Low Power - Non-nested: 10%
- ✅ Low Power - Nested: 30%
- ✅ Macro Intensive: 10%
- ✅ Merged Mode Constraints: 10%
- ✅ DFT - Block Level: 60%
- ✅ Hierarchical: Handled in frontend (flat/hierarchical selection)

## ❌ DISCREPANCIES FOUND

### 1. Block Complexity - Wrong Values
| Factor | Spreadsheet | Current Code | Status |
|--------|-------------|--------------|--------|
| New Design | **20%** | 10% | ❌ **WRONG** |
| Analog IPs | **30%** | 20% | ❌ **WRONG** |
| IO Blocks | **20%** | 10% | ❌ **WRONG** |

### 2. Technology Node Multiplier
- Spreadsheet: **7nm and below → 10%**
- Current: Technology node multipliers exist but may not be applied as percentage
- Status: ⚠️ **NEEDS VERIFICATION** - Check if 7nm and below adds 10% to block complexity

### 3. Full Chip Fixed Resources
| Factor | Spreadsheet | Current Code | Status |
|--------|-------------|--------------|--------|
| PnR | 1.0 resources | ✅ 1.0 resources | ✅ Correct |
| IR Drop Analysis | 0.5 resources | ✅ 0.5 resources | ✅ Correct |
| PV | 1.0 resources | ✅ 1.0 resources | ✅ Correct |
| STA | 1.0 resources | ✅ 1.0 resources | ✅ Correct |
| **Synthesis** | **5%** | ❌ **MISSING** | ❌ **NOT COVERED** |

**Note:** Code has "Synthesis" as fixed resource (1.0) but spreadsheet shows it as 5% percentage factor.

### 4. Full Chip Percentage Factors
- ✅ Low Power - Full Chip: 10%
- ✅ Abutment Floorplan: 10%
- ✅ Analog IP Integration: 10%
- ✅ Modes (> 1 func mode): 10%
- ✅ Blocks Scaling: 9-18=10%, >18=20%
- ✅ mesh/MS-CTS: 30%
- ✅ DFT - Top Level: 30%

### 5. I/O Pad Cell Count
| Level | Spreadsheet | Current Code | Status |
|-------|-------------|--------------|--------|
| Low (<50 pads) | 0% | ✅ 0% | ✅ Correct |
| Medium (50-150 pads) | **10%** | 0% | ❌ **WRONG** |
| High (>150 pads) | 15% | ✅ 15% | ✅ Correct |

### 6. Hierarchical Design Type
- Spreadsheet: **Hierarchical → 100%** (1 per block)
- Current: Hierarchical is selectable in frontend but value may not be applied correctly
- Status: ⚠️ **NEEDS VERIFICATION** - Check if hierarchical adds 100% resources

## 📋 SUMMARY

### Missing/Wrong Parameters:
1. ✅ **FIXED** New Design: Updated to 20% (was 10%)
2. ✅ **FIXED** Analog IPs: Updated to 30% (was 20%)
3. ✅ **FIXED** IO Blocks: Updated to 20% (was 10%)
4. ✅ **FIXED** I/O Pad Medium: Updated to 10% (was 0%)
5. ✅ **FIXED** Full Chip Synthesis: Added as 5% percentage factor (was missing - code had "Synthesis" as name for PnR fixed resource, now fixed)
6. ⚠️ Technology Node 7nm and below: Should add 10% (currently handled via technologyNodeMultipliers - needs verification if applied correctly)
7. ⚠️ Hierarchical: Should add 100% resources (selectable in frontend but needs verification if calculation applies 100% correctly)

### Files to Update:
1. `backend/src/config/default-config.ts` - Fix percentage values
2. `backend/src/estimation/estimation.service.ts` - Verify technology node and hierarchical handling
3. Frontend - Verify all parameters are visible and selectable

