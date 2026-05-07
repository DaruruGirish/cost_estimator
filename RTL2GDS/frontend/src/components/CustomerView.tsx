import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { ProjectConfiguration, BlockConfiguration, FullChipConfiguration } from '../types';
import { apiService } from '../services/api';
import { Header } from './Header';
import { Toast } from './Toast';
import CustomDropdown from './CustomDropdown';
import './CustomerView.css';

// Technology nodes from 180nm to 2nm
const TECHNOLOGY_NODES = [
  '180nm', '130nm', '90nm', '65nm', '45nm', '32nm', '28nm', '22nm', '16nm',
  '14nm', '12nm', '10nm', '7nm', '5nm', '3nm', '2nm'
];

interface CustomerViewProps {
  onRoleChange?: (role: 'admin' | 'customer') => void;
  currentRole?: 'admin' | 'customer';
}

export const CustomerView = ({ }: CustomerViewProps) => {
  const { configuration, loading: configLoading } = useConfig();
  const { userName: authUserName, userEmail: authUserEmail, userRole } = useAuth();

  // Prioritize lead data (from EntryPage) over auth data for non-logged-in customers
  // If user is logged in (has role), use auth data; otherwise use lead data
  const leadName = localStorage.getItem('rtlgds_lead_name');
  const leadEmail = localStorage.getItem('rtlgds_lead_email');

  // For logged-in users, use auth data; for public customers, use lead data
  const userName = userRole ? authUserName : (leadName || authUserName || '');
  const userEmail = userRole ? authUserEmail : (leadEmail || authUserEmail || '');

  // Helper function to ensure Low Power Nested and Non-Nested are mutually exclusive
  const ensureMutualExclusivity = (factors: string[]): string[] => {
    const hasNested = factors.includes('low_power_nested');
    const hasNonNested = factors.includes('low_power_non_nested');

    if (hasNested && hasNonNested) {
      // If both are present, keep only nested (higher priority)
      return factors.filter(f => f !== 'low_power_non_nested');
    }
    return factors;
  };
  // Get initial customer data - prioritize lead data (from EntryPage) over auth data
  const initialLeadName = localStorage.getItem('rtlgds_lead_name');
  const initialLeadEmail = localStorage.getItem('rtlgds_lead_email');
  const initialCustomerName = userRole ? userName : (initialLeadName || userName || '');
  const initialCustomerEmail = userRole ? userEmail : (initialLeadEmail || userEmail || '');

  const [projectConfig, setProjectConfig] = useState<ProjectConfiguration>({
    projectName: '',
    customerName: initialCustomerName || '', // Auto-populate from lead or logged-in user
    emailId: initialCustomerEmail || '', // Auto-populate from lead or logged-in user
    technology: '',
    isFlat: false,
    isFullChipOnly: false,
    fullChip: {
      enabled: false,
      factors: [],
      percentageFactors: [],
      percentageFactorLevels: {},
      dft: false,
      cadFlow: false,
      rtl_drop_count: 3 as 1 | 2 | 3, // Default to 3 RTL drops
      fullChipBlocksTier: 'lt9' as 'lt9' | '9to18' | 'gt18', // Default to < 9 blocks
      designMaturity: null,
      powerDomains: null
    },
    blocks: [{
      blockName: 'Block 1',
      gateCount: 1.0, // Default to <1.5M
      complexityFactors: [], // Design type must be selected by user (mandatory)
      complexityFactorLevels: {},
      dft: false,
      rtl_drop_count: 3 as 1 | 2 | 3 // Default to 3 RTL drops
    }]
  });

  const [price, setPrice] = useState(0);
  const [months, setMonths] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [blockCountInput, setBlockCountInput] = useState<string>('1');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [duplicateNameError, setDuplicateNameError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('project-details');
  const [showCopyPopup, setShowCopyPopup] = useState<number | null>(null); // Block index to show copy popup for
  const [showFullChipCopyPopup, setShowFullChipCopyPopup] = useState<boolean>(false); // Show copy popup for full chip
  const [dismissedCopyPopups, setDismissedCopyPopups] = useState<Set<number>>(new Set()); // Track blocks where copy popup was dismissed
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false); // Show summary modal before calculation
  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState<ProjectConfiguration | null>(null);

  // Auto-populate customer name and email from lead data or logged-in user
  useEffect(() => {
    // Always check localStorage for the most recent lead data
    // This ensures data from EntryPage is used immediately
    const currentLeadName = localStorage.getItem('rtlgds_lead_name');
    const currentLeadEmail = localStorage.getItem('rtlgds_lead_email');

    // For logged-in users, prioritize auth data; for public customers, prioritize lead data
    const finalName = userRole
      ? (userName || currentLeadName || '')
      : (currentLeadName || userName || '');
    const finalEmail = userRole
      ? (userEmail || currentLeadEmail || '')
      : (currentLeadEmail || userEmail || '');

    // Update projectConfig if we have customer data
    if (finalName || finalEmail) {
      setProjectConfig(prev => {
        // Only update if the values are different to avoid unnecessary re-renders
        if (prev.customerName !== finalName || prev.emailId !== finalEmail) {
          return {
            ...prev,
            customerName: finalName || prev.customerName,
            emailId: finalEmail || prev.emailId,
          };
        }
        return prev;
      });
    }
  }, [userName, userEmail, userRole]); // Include userRole in dependencies

  useEffect(() => {
    if (configLoading) return;

    // Set default RTL drop count and initialize blocks when configuration loads
    if (configuration?.blockTimeline && configuration.blockTimeline.length > 0) {
      const defaultRtlDropCount = 3 as 1 | 2 | 3; // Default to 3 RTL drops
      // Only include enabled factors without levels (excluding auto-applied) in the default "all selected" list
      const allComplexityFactors = ensureMutualExclusivity(
        (configuration?.blockComplexity || [])
          .filter(f => f.enabled !== false && !f.autoApplied && (!f.levels || f.levels.length === 0))
          .map(f => f.id)
      );

      setProjectConfig(prev => {
        // If blocks array is empty or needs initialization, create default block
        // CRITICAL: Skip block initialization for Flat Implementation and Full Chip only
        // Default state: No complexity factors selected (empty array)
        const shouldHaveBlocks = !prev.isFlat && !prev.isFullChipOnly;
        let blocks;

        if (prev.blocks.length === 0) {
          // If no blocks and should have blocks, create default block
          // If no blocks and should NOT have blocks (Flat/Full Chip), keep empty array
          blocks = shouldHaveBlocks ? [{
            blockName: 'Block 1',
            gateCount: 1.0, // Default to <1.5M
            complexityFactors: [], // Design type must be selected by user (mandatory)
            complexityFactorLevels: {}, // No levels for block complexity factors
            dft: false,
            rtl_drop_count: defaultRtlDropCount
          }] : [];
        } else {
          // Map existing blocks
          blocks = prev.blocks.map(block => ({
            ...block,
            rtl_drop_count: block.rtl_drop_count || defaultRtlDropCount,
            complexityFactors: ensureMutualExclusivity(block.complexityFactors || [])
          }));
        }

        return {
          ...prev,
          fullChip: {
            ...prev.fullChip,
            rtl_drop_count: prev.fullChip.rtl_drop_count || defaultRtlDropCount,
            fullChipBlocksTier: prev.fullChip.fullChipBlocksTier || 'lt9'
          },
          blocks: blocks.map(block => ({
            ...block,
            rtl_drop_count: block.rtl_drop_count || defaultRtlDropCount,
            complexityFactorLevels: block.complexityFactorLevels || {}
          }))
        };
      });
    }
  }, [configuration, configLoading]);

  // Sync blockCountInput with actual blocks length
  useEffect(() => {
    if (projectConfig.isFlat || projectConfig.isFullChipOnly) {
      setBlockCountInput('0');
    } else {
      setBlockCountInput(projectConfig.blocks.length.toString());
    }
  }, [projectConfig.blocks.length, projectConfig.isFlat, projectConfig.isFullChipOnly]);



  // Scroll-based active section highlighting
  useEffect(() => {
    const handleScroll = () => {
      // Sections vary based on Flat Implementation mode
      // DFT Configuration section removed - DFT Top Level only appears in Flat Implementation
      const sections = projectConfig.fullChip.enabled
        ? ['project-details']
        : ['project-details', 'block-config'];
      // For flat implementation, also single section project details
      if (projectConfig.isFlat) {
        // If flat, logic might differ, but assuming project details covers it
      }
      const scrollPosition = window.scrollY + 150; // Offset for header

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [projectConfig.fullChip.enabled]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Helper functions for summary modal
  // Map factor IDs to UI-friendly display names (matching what user sees in the form)
  const getFactorName = (factorKey: string, isFullChip: boolean = false): string => {
    if (isFullChip) {
      // Map Flat Implementation factors to their UI display names (matching the form labels)
      const uiNameMap: Record<string, string> = {
        'pnr': 'Synthesis',
        'ir_drop': 'EM/IR analysis',
        'pv': 'PV (Physical Verification)',
        'sta': 'STA',
        'low_power_full_chip': 'Low Power',
        'abutment_floorplan': 'Abutment floorplan',
        'analog_ip_integration': 'Analog IP integration',
        'clock_distribution': 'mesh/MS-CTS',
        'modes': '> 1 func mode',
        'dft_enabled': 'DFT'
      };

      if (uiNameMap[factorKey]) {
        return uiNameMap[factorKey];
      }

      // Fallback to configuration name if not in map
      const fixedFactor = configuration?.fullChip?.fixed?.find(f => f.id === factorKey);
      if (fixedFactor) return fixedFactor.name;

      const percentageFactor = configuration?.fullChip?.percentage?.find(f => f.id === factorKey);
      if (percentageFactor) return percentageFactor.name;
    } else {
      const blockFactor = configuration?.blockComplexity?.find(f => f.id === factorKey);
      if (blockFactor) return blockFactor.name;
    }
    return factorKey;
  };

  const getFactorLevelLabel = (factorKey: string, levelId: string, isFullChip: boolean = false): string => {
    if (isFullChip) {
      const percentageFactor = configuration?.fullChip?.percentage?.find(f => f.id === factorKey);
      if (percentageFactor?.levels) {
        const level = percentageFactor.levels.find(l => l.id === levelId);
        if (level) return level.label;
      }
    } else {
      const blockFactor = configuration?.blockComplexity?.find(f => f.id === factorKey);
      if (blockFactor?.levels) {
        const level = blockFactor.levels.find(l => l.id === levelId);
        if (level) return level.label;
      }
    }
    return levelId;
  };

  // Helper function to mark form as changed
  const markAsChanged = () => {
    setHasChanges(true);
  };

  // Wrapper function to update project config
  const updateProjectConfig = (newConfig: ProjectConfiguration) => {
    setProjectConfig(newConfig);
  };

  // Auto-calculation disabled - cost only calculated on save
  // useEffect(() => {
  //   const calculateCostAsync = async () => {
  //     // Technology Node is optional and neutral for now - does not block calculation
  //     // Check if we have at least blocks or full chip enabled
  //     if (projectConfig.blocks.length === 0 && !projectConfig.fullChip.enabled) {
  //       setCost(0);
  //       return;
  //     }

  //     // Ensure all blocks have valid rtl_drop_count and required fields
  //     const defaultRtlDropCount = 3 as 1 | 2 | 3; // Default to 3 RTL drops
  //     // Only include enabled factors without levels (excluding auto-applied) in the default "all selected" list
  //     const allComplexityFactors = ensureMutualExclusivity(
  //       (configuration?.blockComplexity || [])
  //         .filter(f => f.enabled !== false && !f.autoApplied && (!f.levels || f.levels.length === 0))
  //         .map(f => f.id)
  //     );
  //     
  //     const validBlocks = projectConfig.blocks.map(block => ({
  //       blockName: block.blockName,
  //       gateCount: block.gateCount || configuration?.blockGateCount?.baseGateCount || 1.5,
  //       complexityFactors: ensureMutualExclusivity(block.complexityFactors || []), // Default: empty array (no options selected)
  //       complexityFactorLevels: block.complexityFactorLevels || {},
  //       dft: block.dft || false,
  //       rtl_drop_count: block.rtl_drop_count || defaultRtlDropCount
  //     }));
  //
  //     // Ensure full chip has valid rtl_drop_count if enabled
  //     const validFullChip = projectConfig.fullChip.enabled ? {
  //       ...projectConfig.fullChip,
  //       rtl_drop_count: projectConfig.fullChip.rtl_drop_count || defaultRtlDropCount,
  //       factors: projectConfig.fullChip.factors || [],
  //       percentageFactors: projectConfig.fullChip.percentageFactors || [],
  //       percentageFactorLevels: projectConfig.fullChip.percentageFactorLevels || {}
  //     } : projectConfig.fullChip;
  //
  //     const validConfig: ProjectConfiguration = {
  //       projectName: projectConfig.projectName,
  //       customerName: projectConfig.customerName,
  //       emailId: projectConfig.emailId,
  //       technology: projectConfig.technology,
  //       blocks: validBlocks,
  //       fullChip: validFullChip
  //     };
  //
  //     try {
  //       setCalculating(true);
  //       const result = await apiService.calculateCost(validConfig);
  //       const calculatedCost = result?.cost ?? 0;
  //       const calculatedDuration = result?.duration ?? 0;
  //       console.log('Cost calculated:', calculatedCost, 'Duration:', calculatedDuration, 'for config:', validConfig);
  //       setCost(calculatedCost);
  //       setDuration(calculatedDuration);
  //       setBreakdown(result?.breakdown || null);
  //     } catch (error) {
  //       console.error('Failed to calculate cost:', error);
  //       console.error('Project config:', validConfig);
  //       setCost(0);
  //       setDuration(0);
  //       setBreakdown(null);
  //     } finally {
  //       setCalculating(false);
  //     }
  //   };

  // Reduced debounce for faster updates
  // const timeoutId = setTimeout(calculateCostAsync, 300);
  // return () => clearTimeout(timeoutId);
  // }, [projectConfig, configuration]);

  const handleBlockCountChange = (count: number) => {
    // CRITICAL: Don't allow block count changes for Flat Implementation
    if (projectConfig.isFlat) {
      return; // Early return - blocks should remain empty for Flat Implementation
    }

    // For Full Chip Only, just update the numberOfBlocks property, DO NOT generate blocks
    if (projectConfig.isFullChipOnly) {
      const numBlocks = Math.max(0, parseInt(count.toString()) || 0);
      updateProjectConfig({
        ...projectConfig,
        fullChip: {
          ...projectConfig.fullChip,
          numberOfBlocks: numBlocks
        },
        blocks: [] // Ensure blocks are empty
      });
      return;
    }


    const numBlocks = Math.max(1, parseInt(count.toString()) || 1);

    const defaultRtlDropCount = 3 as 1 | 2 | 3; // Default to 3 RTL drops
    // Only include factors without levels in the default "all selected" list
    const allComplexityFactors = ensureMutualExclusivity(
      (configuration?.blockComplexity || [])
        .filter(f => !f.levels || f.levels.length === 0)
        .map(f => f.id)
    );

    // Create new blocks array, preserving existing blocks if they exist
    const newBlocks: BlockConfiguration[] = Array.from({ length: numBlocks }, (_, i) => {
      const existingBlock = projectConfig.blocks[i];
      if (existingBlock) {
        // Preserve existing block but ensure it has all required fields
        let preservedFactors = ensureMutualExclusivity(existingBlock.complexityFactors || []);

        // Design type is mandatory for all blocks - ensure it's preserved

        return {
          ...existingBlock,
          rtl_drop_count: existingBlock.rtl_drop_count || defaultRtlDropCount,
          complexityFactors: preservedFactors,
          complexityFactorLevels: existingBlock.complexityFactorLevels || {}
        };
      }
      // Initialize default complexityFactorLevels for enabled factors with levels (excluding auto-applied)
      const defaultComplexityFactorLevels: Record<string, string> = {};
      (configuration?.blockComplexity || []).forEach(factor => {
        if (factor.enabled !== false && !factor.autoApplied && factor.levels && factor.levels.length > 0) {
          defaultComplexityFactorLevels[factor.id] = factor.levels[0].id;
        }
      });

      // Create new block with defaults
      // Design type is mandatory - user must select (no default)
      const defaultComplexityFactors: string[] = [];

      return {
        blockName: `Block ${i + 1}`,
        gateCount: 1.0, // Default to <1.5M
        complexityFactors: defaultComplexityFactors, // Default: No options selected
        complexityFactorLevels: defaultComplexityFactorLevels,
        dft: false,
        rtl_drop_count: defaultRtlDropCount
      };
    });

    updateProjectConfig({ ...projectConfig, blocks: newBlocks });
  };

  // Helper function to check if copy popup should be shown
  const shouldShowCopyPopup = (index: number, block: BlockConfiguration, target: HTMLElement): boolean => {
    // Only show for blocks after Block 1
    if (index === 0) return false;

    // Only show if block is empty (no complexity factors)
    if (block.complexityFactors && block.complexityFactors.length > 0) return false;

    // Don't show if popup was dismissed for this block
    if (dismissedCopyPopups.has(index)) return false;

    // Don't show if clicking directly on interactive elements
    if (target.closest('input') ||
      target.closest('select') ||
      target.closest('button') ||
      target.closest('label') ||
      target.closest('.custom-dropdown')) {
      return false;
    }

    return true;
  };

  const updateBlock = (index: number, updates: Partial<BlockConfiguration>) => {
    markAsChanged();
    const newBlocks = [...projectConfig.blocks];
    const currentBlock = newBlocks[index];

    // Ensure we have a valid block at this index
    if (!newBlocks[index]) {
      const defaultRtlDropCount = 3 as 1 | 2 | 3;
      newBlocks[index] = {
        blockName: `Block ${index + 1}`,
        gateCount: 1.0, // Default to <1.5M
        complexityFactors: [], // Design type must be selected by user (mandatory)
        complexityFactorLevels: {},
        dft: false,
        rtl_drop_count: defaultRtlDropCount
      };
    }

    // Merge updates with existing block
    const updatedBlock = { ...newBlocks[index], ...updates };

    // Ensure rtl_drop_count is always set
    if (!updatedBlock.rtl_drop_count) {
      updatedBlock.rtl_drop_count = 3 as 1 | 2 | 3;
    }

    // When gate count changes, preserve current complexity level
    // Base effort is taken directly from admin config - no auto-application of complexity
    if (updates.gateCount !== undefined) {
      // Preserve all existing factors (complexity, Low Power, DFT)
      // Gate count change does not auto-apply complexity factors
      // Customer explicitly selects complexity level
      if (updatedBlock.complexityFactors) {
        updatedBlock.complexityFactors = ensureMutualExclusivity(updatedBlock.complexityFactors);
      }
    } else {
      // Ensure mutual exclusivity is maintained for Low Power
      if (updatedBlock.complexityFactors) {
        updatedBlock.complexityFactors = ensureMutualExclusivity(updatedBlock.complexityFactors);
      }
    }

    // Ensure complexityFactorLevels is always an object
    if (!updatedBlock.complexityFactorLevels) {
      updatedBlock.complexityFactorLevels = {};
    }

    newBlocks[index] = updatedBlock;
    updateProjectConfig({ ...projectConfig, blocks: newBlocks });

    // If user starts configuring the block (adds complexity factors), clear dismissed status
    // This allows popup to show again if they clear all factors later
    if (updates.complexityFactors && updates.complexityFactors.length > 0) {
      setDismissedCopyPopups(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  // Calculate handler function - shows summary modal instead of calculating immediately
  const handleCalculate = async () => {
    // Validate required fields
    if (!projectConfig.projectName || projectConfig.projectName.trim() === '') {
      setSaveMessage({ message: 'Please fill in Target Application', type: 'error' });
      return;
    }

    // Validate Technology Node (mandatory)
    if (!projectConfig.technology || projectConfig.technology.trim() === '') {
      setSaveMessage({ message: 'Please select Technology Node', type: 'error' });
      return;
    }

    if (projectConfig.blocks.length === 0 && !projectConfig.fullChip.enabled) {
      setSaveMessage({ message: 'Please add at least one block or enable Full Chip', type: 'error' });
      return;
    }

    // Validate Full Chip only - IO Complexity (if Full Chip is enabled)
    if (projectConfig.fullChip.enabled) {
      const hasIOComplexity = projectConfig.fullChip.percentageFactorLevels &&
        projectConfig.fullChip.percentageFactorLevels['io_pad_count'];
      if (!hasIOComplexity) {
        const scopeType = projectConfig.isFlat ? 'Flat Implementation' : 'Full Chip only';
        setSaveMessage({ message: `Please fill the mandatory fields: IO complexity in ${scopeType}`, type: 'error' });
        return;
      }

      // Validate Full Chip only specific fields (for Full Chip only, not Flat Implementation)
      if (!projectConfig.isFlat) {
        // Check Design Maturity at fullChip level (must be 'new_design' or 'revision')
        if (!projectConfig.fullChip.designMaturity || (projectConfig.fullChip.designMaturity !== 'new_design' && projectConfig.fullChip.designMaturity !== 'revision')) {
          setSaveMessage({ message: 'Please fill the mandatory fields: Design Maturity in Full Chip only', type: 'error' });
          return;
        }

        // Check Power Domains at fullChip level (must be 'none', 'non_nested', or 'nested')
        if (projectConfig.fullChip.powerDomains === null || projectConfig.fullChip.powerDomains === undefined) {
          setSaveMessage({ message: 'Please fill the mandatory fields: Power Domains in Full Chip only', type: 'error' });
          return;
        }

        // Check Glue Logic (mandatory)
        if (projectConfig.fullChip.glueLogic === null || projectConfig.fullChip.glueLogic === undefined) {
          setSaveMessage({ message: 'Please fill the mandatory fields: Glue Logic in Full Chip only', type: 'error' });
          return;
        }
      }
    }

    // Validate Block Scope Definitions - mandatory fields for each block
    // Skip block validation for Flat Implementation and Full Chip only (no blocks needed)
    const isFullChipOnly = !projectConfig.isFlat && projectConfig.fullChip.enabled;
    const isFlatImplementation = projectConfig.isFlat && projectConfig.fullChip.enabled;
    if (projectConfig.blocks.length > 0 && !isFlatImplementation && !isFullChipOnly) {
      for (let i = 0; i < projectConfig.blocks.length; i++) {
        const block = projectConfig.blocks[i];
        const blockNum = i + 1;
        const blockName = block.blockName || `Block ${blockNum}`;

        // Check Inst Count
        if (!block.gateCount || block.gateCount === 0) {
          setSaveMessage({ message: `Please fill the mandatory fields: Inst Count for ${blockName}`, type: 'error' });
          return;
        }

        // Check RTL Drops
        if (!block.rtl_drop_count) {
          setSaveMessage({ message: `Please fill the mandatory fields: RTL Drops for ${blockName}`, type: 'error' });
          return;
        }

        // Check Power Domains (should have one selected: none, non_nested, or nested)
        const hasPowerDomain = block.complexityFactors?.includes('low_power_nested') ||
          block.complexityFactors?.includes('low_power_non_nested');
        // Note: If neither is selected, it's considered "None" which is valid, so we don't need to check this

        // Check Design Maturity (should have new_design or revision)
        const hasDesignMaturity = block.complexityFactors?.includes('new_design') ||
          block.complexityFactors?.includes('revision');
        if (!hasDesignMaturity) {
          setSaveMessage({ message: `Please fill the mandatory fields: Design Maturity for ${blockName}`, type: 'error' });
          return;
        }

        // Check Design Type (mandatory only for Block 2 onwards, Block 1 is disabled)
        // Block 1 (i === 0) doesn't need design type - they build first block first
        // Block 2+ (i >= 1) must have design type selected
        if (i > 0) {
          const hasDesignType = block.complexityFactors?.includes('hierarchical') ||
            block.complexityFactors?.includes('flat');
          if (!hasDesignType) {
            setSaveMessage({ message: `Please fill the mandatory fields: Design Type for ${blockName}`, type: 'error' });
            return;
          }
        }
      }
    }

    // Duplicate project names are allowed - removed duplicate check
    setDuplicateNameError(null); // Clear any existing error

    // Show summary modal
    setShowSummaryModal(true);
  };

  // Confirm handler - actually calculates cost and saves project
  const handleConfirm = async () => {
    try {
      setSaving(true); // Reuse saving state for loading indicator
      setSaveMessage(null); // Clear any previous messages

      // Duplicate project names are allowed - removed duplicate check
      setDuplicateNameError(null); // Clear any existing error

      setShowSummaryModal(false); // Close summary modal

      // Prepare project config for calculation
      const defaultRtlDropCount = 3 as 1 | 2 | 3;
      // CRITICAL: Full Chip only and Flat Implementation must have NO blocks
      const validBlocks = (projectConfig.isFlat || projectConfig.isFullChipOnly) ? [] : projectConfig.blocks.map((block, index) => {
        const gateCount = block.gateCount || 1.0;
        console.log(`[DEBUG] Block ${index + 1} gateCount being sent to backend:`, gateCount);
        return {
          blockName: block.blockName,
          gateCount: gateCount, // Default to <1.5M
          complexityFactors: ensureMutualExclusivity(block.complexityFactors || []),
          complexityFactorLevels: block.complexityFactorLevels || {},
          dft: block.dft || false,
          rtl_drop_count: block.rtl_drop_count || defaultRtlDropCount
        };
      });

      const validFullChip = projectConfig.fullChip.enabled ? {
        ...projectConfig.fullChip,
        rtl_drop_count: projectConfig.fullChip.rtl_drop_count || defaultRtlDropCount,
        factors: projectConfig.fullChip.factors || [],
        percentageFactors: projectConfig.fullChip.percentageFactors || [],
        percentageFactorLevels: projectConfig.fullChip.percentageFactorLevels || {},
        fullChipBlocksTier: projectConfig.fullChip.fullChipBlocksTier || 'lt9'
      } : projectConfig.fullChip;

      const calculateConfig: ProjectConfiguration = {
        projectName: projectConfig.projectName, // Project name is now required (validated above)
        customerName: projectConfig.customerName || userName || '',
        emailId: projectConfig.emailId || userEmail || '',
        technology: projectConfig.technology,
        blocks: validBlocks,
        fullChip: validFullChip,
        isFlat: projectConfig.isFlat || false, // Include isFlat flag for Flat Implementation routing
        isFullChipOnly: projectConfig.isFullChipOnly || false // Include isFullChipOnly flag
      };

      // SINGLE SOURCE OF TRUTH: All cost/effort calculations come from backend API
      // Backend EstimationService.calculateCost() is the ONLY calculation function
      // UI MUST use values directly from API response - NO frontend calculation or recomputation
      // Save project when confirm is clicked to store customer details in admin view
      const result = await apiService.calculateCost(calculateConfig, true); // save: true - calculate and save

      // Update price/months directly from backend API response (SINGLE SOURCE OF TRUTH)
      setPrice(result.price);
      setMonths(result.months);
      if (result.saved && result.projectId) {
        setSaveMessage({
          message: 'Cost calculated and project saved successfully!',
          type: 'success'
        });
        setIsSaved(true);
        setHasChanges(false);
        setSavedConfigSnapshot({ ...calculateConfig });
      } else {
        setSaveMessage({ message: 'Cost calculated successfully!', type: 'success' });
      }
    } catch (error: any) {
      console.error('Failed to calculate cost:', error);
      setSaveMessage({
        message: error?.message || 'Failed to calculate cost. Please try again.',
        type: 'error'
      });
      setPrice(0);
      setMonths(0);
    } finally {
      setSaving(false);
    }
  };

  // Save handler function (saves project after calculation)
  const handleSave = async () => {
    // Validate required fields
    // Customer name and email are auto-populated from login, but validate they exist
    if (!projectConfig.projectName) {
      setSaveMessage({ message: 'Please fill in Project Name', type: 'error' });
      return;
    }

    // Validate Technology Node (mandatory)
    if (!projectConfig.technology || projectConfig.technology.trim() === '') {
      setSaveMessage({ message: 'Please select Technology Node', type: 'error' });
      return;
    }

    // Ensure customer name and email are set from logged-in user
    const finalCustomerName = projectConfig.customerName || userName || '';
    const finalEmailId = projectConfig.emailId || userEmail || '';

    if (!finalCustomerName || !finalEmailId) {
      setSaveMessage({ message: 'Customer information is missing. Please log in again.', type: 'error' });
      return;
    }

    if (projectConfig.blocks.length === 0 && !projectConfig.fullChip.enabled) {
      setSaveMessage({ message: 'Please add at least one block or enable Full Chip', type: 'error' });
      return;
    }

    try {
      setSaving(true);

      // Prepare project config for saving (same as calculation)
      const defaultRtlDropCount = 3 as 1 | 2 | 3;
      // CRITICAL: Full Chip only and Flat Implementation must have NO blocks
      const validBlocks = (projectConfig.isFlat || projectConfig.isFullChipOnly) ? [] : projectConfig.blocks.map(block => ({
        blockName: block.blockName,
        gateCount: block.gateCount || 1.0, // Default to <1.5M
        complexityFactors: ensureMutualExclusivity(block.complexityFactors || []),
        complexityFactorLevels: block.complexityFactorLevels || {},
        dft: block.dft || false,
        rtl_drop_count: block.rtl_drop_count || defaultRtlDropCount
      }));

      const validFullChip = projectConfig.fullChip.enabled ? {
        ...projectConfig.fullChip,
        rtl_drop_count: projectConfig.fullChip.rtl_drop_count || defaultRtlDropCount,
        factors: projectConfig.fullChip.factors || [],
        percentageFactors: projectConfig.fullChip.percentageFactors || [],
        percentageFactorLevels: projectConfig.fullChip.percentageFactorLevels || {},
        fullChipBlocksTier: projectConfig.fullChip.fullChipBlocksTier || 'lt9'
      } : projectConfig.fullChip;

      const saveConfig: ProjectConfiguration = {
        projectName: projectConfig.projectName,
        customerName: finalCustomerName, // Use auto-populated value from logged-in user
        emailId: finalEmailId, // Use auto-populated value from logged-in user
        technology: projectConfig.technology,
        blocks: validBlocks,
        fullChip: validFullChip,
        isFlat: projectConfig.isFlat || false, // Include isFlat flag for Flat Implementation routing
        isFullChipOnly: projectConfig.isFullChipOnly || false // Include isFullChipOnly flag
      };

      // SINGLE SOURCE OF TRUTH: All cost/effort calculations come from backend API
      // Backend EstimationService.calculateCost() is the ONLY calculation function
      // UI MUST use values directly from API response - NO frontend calculation or recomputation
      const result = await apiService.calculateCost(saveConfig, true);

      if (result.saved && result.projectId) {
        setSaveMessage({
          message: 'Project saved successfully!',
          type: 'success'
        });
        // Update price/months directly from backend API response (SINGLE SOURCE OF TRUTH)
        setPrice(result.price);
        setMonths(result.months);
        setIsSaved(true);
        setHasChanges(false);
        setSavedConfigSnapshot({ ...saveConfig });
      } else {
        setSaveMessage({ message: 'Project saved successfully!', type: 'success' });
        // Update price/months directly from backend API response (SINGLE SOURCE OF TRUTH)
        setPrice(result.price);
        setMonths(result.months);
        setIsSaved(true);
        setHasChanges(false);
        setSavedConfigSnapshot({ ...saveConfig });
      }
    } catch (error: any) {
      console.error('Failed to save project:', error);
      setSaveMessage({
        message: error?.message || 'Failed to save project. Please try again.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="customer-view">
      <Header
        title="Project Cost Estimation"
        price={price}
        months={months}
        isCalculating={saving}
        onCalculate={handleCalculate}
      />
      <div className="customer-layout">
        {/* Main Content Area */}
        <div className="customer-main-content">
          <div className="form-container">
            {/* Project Overview Section */}
            <div id="project-overview" className="form-section">
              <h2 style={{ color: '#0d7377', fontSize: '24px' }}>Project Overview</h2>
              <p className="section-subtitle">High-level inputs that define project scope and scale.</p>
              <div className="form-row">
                <div className="form-group">
                  <label>Target Application <span style={{ color: '#e53e3e' }}>*</span></label>
                  <input
                    type="text"
                    value={projectConfig.projectName}
                    onChange={(e) => {
                      markAsChanged();
                      updateProjectConfig({ ...projectConfig, projectName: e.target.value });
                      // Clear duplicate error when user types
                      if (duplicateNameError) {
                        setDuplicateNameError(null);
                      }
                    }}
                    placeholder="e.g., Vision Processor, Network SoC, AI/ML Accelerator"
                    required
                    className={duplicateNameError ? 'input-error' : ''}
                  />
                  {duplicateNameError && (
                    <div className="field-error-message">{duplicateNameError}</div>
                  )}
                </div>
                <div className="form-group">
                  <label>Technology Node <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></label>
                  <CustomDropdown
                    value={projectConfig.technology}
                    onChange={(value) => {
                      markAsChanged();
                      updateProjectConfig({ ...projectConfig, technology: value });
                    }}
                    options={TECHNOLOGY_NODES.map(tech => ({ value: tech, label: tech }))}
                    style={{ width: '100%' }}
                    searchable={true}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Engagement Scope</label>
                <div className="radio-group">
                  <label className="radio-label" data-tooltip="Select this if both individual block development and full-chip integration are required.">
                    <input
                      type="radio"
                      name="fullChip"
                      value="Block + Full-Chip"
                      checked={projectConfig.fullChip.enabled && !projectConfig.isFlat && !projectConfig.isFullChipOnly}
                      onChange={() => {
                        // When selecting Block + Full-Chip, reset to completely fresh state
                        const defaultRtlDropCount = 3 as 1 | 2 | 3;

                        // Create a completely new fullChip object to ensure all old values are cleared
                        const freshFullChip: FullChipConfiguration = {
                          enabled: true,
                          factors: [], // Reset all execution scope factors
                          percentageFactors: [], // Reset all percentage factors
                          percentageFactorLevels: {}, // Reset all level selections
                          dft: false,
                          cadFlow: false,
                          rtl_drop_count: defaultRtlDropCount,
                          fullChipBlocksTier: 'lt9' as 'lt9' | '9to18' | 'gt18',
                          designMaturity: null,
                          powerDomains: null,
                          glueLogic: false, // Mandatory field - default to false
                          instanceCount: undefined
                        };

                        updateProjectConfig({
                          projectName: projectConfig.projectName,
                          customerName: projectConfig.customerName,
                          emailId: projectConfig.emailId,
                          technology: projectConfig.technology,
                          isFlat: false,
                          isFullChipOnly: false,
                          fullChip: freshFullChip,
                          blocks: projectConfig.blocks.length > 0 ? projectConfig.blocks : [{
                            blockName: 'Block 1',
                            gateCount: 1.0,
                            complexityFactors: [], // Design type must be selected by user (mandatory)
                            complexityFactorLevels: {},
                            dft: false,
                            rtl_drop_count: defaultRtlDropCount
                          }]
                        });
                        markAsChanged();
                      }}
                    />
                    <span>Block + Full-Chip</span>
                  </label>
                  <label className="radio-label" data-tooltip="Select this if work is limited to block-level implementation and signoff, with no full-chip integration.">
                    <input
                      type="radio"
                      name="fullChip"
                      value="Block Development only"
                      checked={!projectConfig.fullChip.enabled && !projectConfig.isFlat && !projectConfig.isFullChipOnly}
                      onChange={() => {
                        updateProjectConfig({
                          ...projectConfig,
                          isFlat: false,
                          isFullChipOnly: false,
                          fullChip: { ...projectConfig.fullChip, enabled: false }
                        });
                      }}
                    />
                    <span>Block Development only</span>
                  </label>
                  <label className="radio-label" data-tooltip="Select this if block-level development is already completed and only full-chip integration and signoff are needed.">
                    <input
                      type="radio"
                      name="fullChip"
                      value="Full Chip only"
                      checked={projectConfig.isFullChipOnly && !projectConfig.isFlat}
                      onChange={() => {
                        // When selecting Full Chip only, reset to completely fresh state
                        const defaultRtlDropCount = 3 as 1 | 2 | 3;

                        // Switch to Full Chip only - complete reset to fresh state
                        // Create a completely new fullChip object to ensure all old values are cleared
                        const freshFullChip: FullChipConfiguration = {
                          enabled: true,
                          factors: [], // Reset all execution scope factors (pnr, sta, pv, ir_drop)
                          percentageFactors: [], // Reset all percentage factors (analog_ip_integration, clock_distribution, macro_intensive, etc.)
                          percentageFactorLevels: {}, // Reset all level selections (io_pad_count, etc.)
                          dft: false,
                          cadFlow: false,
                          rtl_drop_count: defaultRtlDropCount,
                          fullChipBlocksTier: 'lt9' as 'lt9' | '9to18' | 'gt18',
                          designMaturity: null,
                          powerDomains: null,
                          glueLogic: false, // Mandatory field - default to false
                          instanceCount: undefined
                        };

                        // Force a complete state reset by creating a completely new object
                        // This ensures React detects the change and re-renders properly
                        // CRITICAL: Full Chip only should have NO blocks (empty array)
                        // This ensures routing to FullChipConfigurationService instead of Integration mode
                        const newConfig: ProjectConfiguration = {
                          projectName: projectConfig.projectName,
                          customerName: projectConfig.customerName,
                          emailId: projectConfig.emailId,
                          technology: projectConfig.technology,
                          isFullChipOnly: true,
                          isFlat: false, // Explicitly false - this is critical
                          fullChip: { ...freshFullChip, numberOfBlocks: 0 }, // Create new object reference with initialized blocks count
                          blocks: [] // Full Chip only must have NO blocks
                        };

                        updateProjectConfig(newConfig);
                        setBlockCountInput('0');
                        markAsChanged();
                      }}
                    />
                    <span>Full Chip only</span>
                  </label>
                  <label className="radio-label" data-tooltip="Select this if the design is implemented as a single flat database with no hierarchical block structure.">
                    <input
                      type="radio"
                      name="fullChip"
                      value="Flat implementation"
                      checked={projectConfig.isFlat}
                      onChange={() => {
                        // When selecting Flat implementation, reset to completely fresh state
                        const defaultRtlDropCount = 3 as 1 | 2 | 3;

                        // Create a completely new fullChip object to ensure all old values are cleared
                        const freshFullChip: FullChipConfiguration = {
                          enabled: true,
                          factors: [], // Reset all execution scope factors
                          percentageFactors: [], // Reset all percentage factors
                          percentageFactorLevels: {}, // Reset all level selections
                          dft: false,
                          cadFlow: false,
                          rtl_drop_count: defaultRtlDropCount,
                          fullChipBlocksTier: 'lt9' as 'lt9' | '9to18' | 'gt18',
                          designMaturity: null,
                          powerDomains: null,
                          glueLogic: false, // Mandatory field - default to false
                          instanceCount: undefined
                        };

                        // Switch to Flat Implementation - complete reset to fresh state
                        updateProjectConfig({
                          projectName: projectConfig.projectName,
                          customerName: projectConfig.customerName,
                          emailId: projectConfig.emailId,
                          technology: projectConfig.technology,
                          isFlat: true,
                          isFullChipOnly: true,
                          fullChip: freshFullChip,
                          blocks: [] // No blocks for flat implementation
                        });
                        setBlockCountInput('0');
                        markAsChanged();
                      }}
                    />
                    <span>Flat implementation</span>
                  </label>
                </div>
              </div>

              {/* Number of Blocks - Show only for Block Development and Block + Full-Chip  AND NOW Full Chip Only */}
              {!projectConfig.isFlat && (
                <div className="form-group">
                  <label>Number of Blocks</label>
                  <input
                    type="number"
                    min={projectConfig.isFlat ? "0" : "1"}
                    step="1"
                    value={blockCountInput}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      // Allow empty input temporarily for clearing
                      setBlockCountInput(inputValue);

                      if (inputValue === '' || inputValue === '-') {
                        return; // Allow temporary empty state
                      }

                      const newCount = parseInt(inputValue, 10);
                      if (!isNaN(newCount) && newCount >= 1) {
                        handleBlockCountChange(newCount);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    onBlur={(e) => {
                      if (projectConfig.isFlat || projectConfig.isFullChipOnly) return;
                      // Ensure minimum of 1 when field loses focus
                      const inputValue = e.target.value.trim();
                      if (inputValue === '' || isNaN(parseInt(inputValue, 10))) {
                        setBlockCountInput('1');
                        handleBlockCountChange(1);
                      } else {
                        const value = parseInt(inputValue, 10);
                        if (value < 1) {
                          setBlockCountInput('1');
                          handleBlockCountChange(1);
                        } else {
                          setBlockCountInput(value.toString());
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      backgroundColor: projectConfig.isFlat ? '#e2e8f0' : '#ffffff',
                      cursor: projectConfig.isFlat ? 'not-allowed' : 'text',
                      opacity: projectConfig.isFlat ? 0.6 : 1,
                      color: projectConfig.isFlat ? '#64748b' : 'inherit'
                    }}
                    disabled={projectConfig.isFlat}
                  />
                </div>
              )}
            </div>

            {(projectConfig.fullChip.enabled || projectConfig.isFlat) && (
              <div
                key={`mode-${projectConfig.isFlat ? 'flat' : projectConfig.isFullChipOnly ? 'fullchip-only' : 'fullchip-blocks'}-factors-${projectConfig.fullChip.factors.join(',')}-percent-${projectConfig.fullChip.percentageFactors.join(',')}`}
                className="form-section"
                data-testid="full-chip-config-section"
              >
                <h2 style={{ color: '#0d7377' }}>
                  {projectConfig.isFlat
                    ? 'Flat Implementation'
                    : projectConfig.isFullChipOnly
                      ? 'Full Chip only'
                      : 'Full Chip Scope Definition'}
                </h2>
                <p className="section-subtitle">Integration, signoff, and top-level complexity drivers.</p>

                <div className="blocks-table-container full-chip-config-table">
                  <div className="blocks-table-wrapper">
                    {/* Table Header Row */}
                    <div className="blocks-table-header">
                      <div className="blocks-table-cell header-cell" data-tooltip="Planned number of RTL releases">RTL Drops <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                      <div className="blocks-table-cell header-cell" data-tooltip="Select this if IO pad planning and IO integration are part of the scope.">IO complexity <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                      <div className="blocks-table-cell header-cell" data-tooltip="Select the appropriate option based on whether the design has single or multiple power domains.">Power Domains <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                      <div className="blocks-table-cell header-cell" data-tooltip="Select New Design for first-time implementation, or Revision for an existing design update.">Design Maturity <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                      <div className="blocks-table-cell header-cell">Glue Logic <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                      <div className="blocks-table-cell header-cell full-chip-execution-scope">Execution Scope</div>
                    </div>

                    {/* Table Body Row */}
                    <div className="blocks-table-row" style={{ alignItems: 'flex-start' }}>

                      {/* 1. RTL Drops */}
                      <div className="blocks-table-cell">
                        <CustomDropdown
                          value={projectConfig.fullChip.rtl_drop_count || 3}
                          onChange={(val) => {
                            markAsChanged();
                            updateProjectConfig({
                              ...projectConfig,
                              fullChip: { ...projectConfig.fullChip, rtl_drop_count: val as 1 | 2 | 3 }
                            });
                          }}
                          options={[
                            { value: 1, label: '1' },
                            { value: 2, label: '2' },
                            { value: 3, label: '3' }
                          ]}
                        />
                      </div>

                      {/* 2. IO Complexity */}
                      <div className="blocks-table-cell">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {configuration.fullChip.percentage
                            .filter(factor => factor.id === 'io_pad_count')
                            .map(factor => {
                              const selectedLevel = projectConfig.fullChip.percentageFactorLevels?.[factor.id] || '';
                              return factor.levels?.map(level => {
                                const isSelected = selectedLevel === level.id;
                                return (
                                  <label
                                    key={level.id}
                                    className="radio-column-label"
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0', width: '100%' }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      if (isSelected) {
                                        const newLevels = { ...(projectConfig.fullChip.percentageFactorLevels || {}) };
                                        delete newLevels[factor.id];
                                        markAsChanged();
                                        updateProjectConfig({ ...projectConfig, fullChip: { ...projectConfig.fullChip, percentageFactorLevels: newLevels } });
                                      } else {
                                        const newLevels = { ...(projectConfig.fullChip.percentageFactorLevels || {}), [factor.id]: level.id };
                                        markAsChanged();
                                        updateProjectConfig({ ...projectConfig, fullChip: { ...projectConfig.fullChip, percentageFactorLevels: newLevels } });
                                      }
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      checked={isSelected}
                                      onChange={() => { }}
                                      onClick={(e) => e.preventDefault()}
                                      style={{ margin: 0 }}
                                    />
                                    <span style={{ color: '#1a202c' }}>{level.label}</span>
                                  </label>
                                );
                              });
                            }).flat()}
                        </div>
                      </div>

                      {/* 3. Power Domains */}
                      <div className="blocks-table-cell">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            { value: 'none', label: 'None' },
                            { value: 'non_nested', label: 'Non-nested' },
                            { value: 'nested', label: 'Nested' }
                          ].map((option) => {
                            const isSelected = projectConfig.fullChip.powerDomains === option.value;
                            return (
                              <label
                                key={option.value}
                                className="radio-column-label"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0', width: '100%' }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (isSelected) {
                                    markAsChanged(); updateProjectConfig({ ...projectConfig, fullChip: { ...projectConfig.fullChip, powerDomains: null } });
                                  } else {
                                    markAsChanged(); updateProjectConfig({ ...projectConfig, fullChip: { ...projectConfig.fullChip, powerDomains: option.value as 'none' | 'non_nested' | 'nested' } });
                                  }
                                }}
                              >
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  onClick={(e) => e.preventDefault()}
                                  style={{ margin: 0 }}
                                />
                                <span style={{ color: '#1a202c' }}>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. Design Maturity */}
                      <div className="blocks-table-cell">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            { value: 'new_design', label: 'New Design' },
                            { value: 'revision', label: 'Revision' }
                          ].map((option) => {
                            const isSelected = projectConfig.fullChip.designMaturity === option.value;
                            return (
                              <label
                                key={option.value}
                                className="radio-column-label"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0', width: '100%' }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (isSelected) {
                                    markAsChanged(); updateProjectConfig({ ...projectConfig, fullChip: { ...projectConfig.fullChip, designMaturity: null } });
                                  } else {
                                    markAsChanged(); updateProjectConfig({ ...projectConfig, fullChip: { ...projectConfig.fullChip, designMaturity: option.value as 'new_design' | 'revision' } });
                                  }
                                }}
                              >
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  onClick={(e) => e.preventDefault()}
                                  style={{ margin: 0 }}
                                />
                                <span style={{ color: '#1a202c' }}>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* 5. Glue Logic (Mandatory) */}
                      <div className="blocks-table-cell" style={{ position: 'relative', overflow: 'visible' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            { value: true, label: 'Yes' },
                            { value: false, label: 'No' }
                          ].map((option) => {
                            const isSelected = option.value === true ? projectConfig.fullChip.glueLogic === true : projectConfig.fullChip.glueLogic === false;
                            return (
                              <div key={option.label} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                <label
                                  className="radio-column-label"
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0', width: '100%' }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (isSelected) return;

                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig, fullChip: {
                                        ...projectConfig.fullChip, glueLogic: option.value, instanceCount: option.value ? (projectConfig.fullChip.instanceCount || 1.5) : undefined
                                      }
                                    });
                                  }}
                                >
                                  <input
                                    type="radio"
                                    checked={isSelected}
                                    onChange={() => { }}
                                    onClick={(e) => e.preventDefault()}
                                    style={{ margin: 0 }}
                                  />
                                  <span style={{ color: '#1a202c' }}>{option.label}</span>
                                </label>

                                {option.value === true && isSelected && (
                                  <div style={{ marginTop: '4px', marginBottom: '8px', width: '100%', paddingLeft: '24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a202c', whiteSpace: 'nowrap' }}>Inst Count:</span>
                                    <CustomDropdown
                                      className="glue-logic-dropdown"
                                      value={projectConfig.fullChip.instanceCount || 1.5}
                                      onChange={(value) => {
                                        markAsChanged();
                                        updateProjectConfig({ ...projectConfig, fullChip: { ...projectConfig.fullChip, instanceCount: value } });
                                      }}
                                      options={[
                                        { value: 1.5, label: '<1.5' },
                                        { value: 2.5, label: '<2.5' },
                                        { value: 3.5, label: '<3.5' },
                                        { value: 4.5, label: '<4.5' }
                                      ]}
                                      style={{ width: '90px' }}
                                      maxHeight="300px" // Explicitly allow this one to be taller
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 6. Execution Scope */}
                      <div className="blocks-table-cell full-chip-execution-scope">
                        <div className="execution-scope-grid">
                          {/* For Flat Implementation: Show Flat-specific parameters */}
                          {projectConfig.isFlat ? (
                            <>
                              {/* Row 1 */}
                              <label className="execution-scope-item" data-tooltip="Select this if RTL-to-gate synthesis needs to be performed for this block or full chip.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('pnr')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'pnr']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'pnr');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>Synthesis</span>
                              </label>

                              {/* Column 2, Row 1: Analog IP integration */}
                              <label className="execution-scope-item" data-tooltip="Select this if the design contains analog or mixed-signal IPs that need integration.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('analog_ip_integration')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'analog_ip_integration']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'analog_ip_integration');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>Analog IP integration</span>
                              </label>

                              {/* Column 3, Row 1: STA */}
                              <label className="execution-scope-item" data-tooltip="Select this if full timing signoff is required across all modes and corners.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('sta')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'sta']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'sta');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>STA</span>
                              </label>

                              {/* Column 4, Row 1: mesh/MS-CTS */}
                              <label className="execution-scope-item" data-tooltip="Select this if mesh or multi-source clock tree synthesis is required.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('clock_distribution')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'clock_distribution']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'clock_distribution');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>mesh/MS-CTS</span>
                              </label>

                              {/* Row 2 */}
                              {/* Column 1, Row 2: DFT */}
                              <label className="execution-scope-item" data-tooltip="Select this if DFT needs to be done for this block or full chip.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.dft}
                                  onChange={(e) => {
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, dft: e.target.checked }
                                    });
                                  }}
                                />
                                <span>DFT</span>
                              </label>

                              {/* Column 2, Row 2: macro intensive */}
                              <label className="execution-scope-item" data-tooltip="Select this if the design contains more than 100 macros (SRAMs or hard IPs).">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('macro_intensive')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'macro_intensive']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'macro_intensive');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>macro intensive</span>
                              </label>

                              {/* Column 3, Row 2: Merged mode SDC */}
                              <label className="execution-scope-item" data-tooltip="Select this if a single SDC file is used to cover multiple modes and scenarios.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('merged_mode_constraints')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'merged_mode_constraints']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'merged_mode_constraints');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>Merged mode SDC</span>
                              </label>

                              {/* Column 4, Row 2: > 1 func mode */}
                              <label className="execution-scope-item" data-tooltip="Select this if the design operates in more than one functional mode.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('modes')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'modes']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'modes');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>&gt; 1 func mode</span>
                              </label>

                              {/* Row 3 */}
                              {/* Column 1, Row 3: PV (Physical Verification) */}
                              <label className="execution-scope-item" data-tooltip="Select this if DRC, LVS, and other signoff physical checks are required.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('pv')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'pv']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'pv');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>PV (Physical Verification)</span>
                              </label>

                              {/* Column 2, Row 3: EM/IR analysis */}
                              <label className="execution-scope-item" data-tooltip="Select this if power integrity checks for EM and IR drop are required.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('ir_drop')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'ir_drop']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'ir_drop');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>EM/IR analysis</span>
                              </label>

                              {/* Empty cells for Row 3 */}
                              <div></div>
                              <div></div>
                            </>
                          ) : projectConfig.isFullChipOnly && !projectConfig.isFlat ? (
                            <>
                              {/* For Full Chip only: Show specific parameters in 4 columns, 3 rows */}
                              {/* Row 1 */}
                              <label className="execution-scope-item" data-tooltip="Select this if RTL-to-gate synthesis needs to be performed for this block or full chip.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('pnr')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'pnr']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'pnr');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>Synthesis</span>
                              </label>

                              {/* Column 2, Row 1: Analog IP integration */}
                              <label className="execution-scope-item" data-tooltip="Select this if the design contains analog or mixed-signal IPs that need integration.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('analog_ip_integration')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'analog_ip_integration']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'analog_ip_integration');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>Analog IP integration</span>
                              </label>

                              {/* Column 3, Row 1: STA */}
                              <label className="execution-scope-item" data-tooltip="Select this if full timing signoff is required across all modes and corners.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('sta')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'sta']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'sta');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>STA</span>
                              </label>

                              {/* Column 4, Row 1: mesh/MS-CTS */}
                              <label className="execution-scope-item" data-tooltip="Select this if mesh or multi-source clock tree synthesis is required.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('clock_distribution')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'clock_distribution']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'clock_distribution');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>mesh/MS-CTS</span>
                              </label>

                              {/* Row 2 */}
                              {/* Column 1, Row 2: DFT */}
                              <label className="execution-scope-item" data-tooltip="Select this if DFT needs to be done for this block or full chip.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.dft}
                                  onChange={(e) => {
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, dft: e.target.checked }
                                    });
                                  }}
                                />
                                <span>DFT</span>
                              </label>

                              {/* Column 2, Row 2: macro intensive (for Full Chip only) */}
                              <label className="execution-scope-item" data-tooltip="Select this if the design contains more than 100 macros (SRAMs or hard IPs).">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('macro_intensive')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'macro_intensive']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'macro_intensive');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>macro intensive</span>
                              </label>

                              {/* Column 3, Row 2: Merged mode SDC */}
                              <label className="execution-scope-item" data-tooltip="Select this if a single SDC file is used to cover multiple modes and scenarios.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('merged_mode_constraints')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'merged_mode_constraints']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'merged_mode_constraints');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>Merged mode SDC</span>
                              </label>

                              {/* Column 4, Row 2: > 1 func mode */}
                              <label className="execution-scope-item" data-tooltip="Select this if the design operates in more than one functional mode.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.percentageFactors.includes('modes')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.percentageFactors, 'modes']
                                      : projectConfig.fullChip.percentageFactors.filter(f => f !== 'modes');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                    });
                                  }}
                                />
                                <span>&gt; 1 func mode</span>
                              </label>

                              {/* Row 3 */}
                              {/* Column 1, Row 3: PV (Physical Verification) */}
                              <label className="execution-scope-item" data-tooltip="Select this if DRC, LVS, and other signoff physical checks are required.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('pv')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'pv']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'pv');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>PV (Physical Verification)</span>
                              </label>

                              {/* Column 2, Row 3: EM/IR analysis */}
                              <label className="execution-scope-item" data-tooltip="Select this if power integrity checks for EM and IR drop are required.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('ir_drop')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'ir_drop']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'ir_drop');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>EM/IR analysis</span>
                              </label>

                              {/* Column 3, Row 3: Abutment floorplan (only for Full Chip only, not Flat Implementation) */}
                              {!projectConfig.isFlat && (
                                <label className="execution-scope-item" data-tooltip="Select this if the full chip is built by abutting blocks with/without top-level glue logic.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('abutment_floorplan')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'abutment_floorplan']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'abutment_floorplan');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>Abutment floorplan</span>
                                </label>
                              )}
                              {/* Empty cell for Flat Implementation when Abutment floorplan is hidden */}
                              {projectConfig.isFlat && <div></div>}

                              {/* Empty cell for Row 3, Column 4 */}
                              <div></div>
                            </>
                          ) : (
                            <>
                              {/* Column 1, Row 1: Synthesis */}
                              <label className="execution-scope-item" data-tooltip="Select this if RTL-to-gate synthesis needs to be performed for this block or full chip.">
                                <input
                                  type="checkbox"
                                  checked={projectConfig.fullChip.factors.includes('pnr')}
                                  onChange={(e) => {
                                    const factors = e.target.checked
                                      ? [...projectConfig.fullChip.factors, 'pnr']
                                      : projectConfig.fullChip.factors.filter(f => f !== 'pnr');
                                    markAsChanged();
                                    updateProjectConfig({
                                      ...projectConfig,
                                      fullChip: { ...projectConfig.fullChip, factors }
                                    });
                                  }}
                                />
                                <span>Synthesis</span>
                              </label>

                              {/* Column 2, Row 1: Analog IP integration (for Flat) or STA (for Full Chip) */}
                              {projectConfig.isFlat ? (
                                <label className="execution-scope-item" data-tooltip="Select this if the design contains analog or mixed-signal IPs that need integration.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('analog_ip_integration')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'analog_ip_integration']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'analog_ip_integration');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>Analog IP integration</span>
                                </label>
                              ) : (
                                <label className="execution-scope-item" data-tooltip="Select this if full timing signoff is required across all modes and corners.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.factors.includes('sta')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.factors, 'sta']
                                        : projectConfig.fullChip.factors.filter(f => f !== 'sta');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, factors }
                                      });
                                    }}
                                  />
                                  <span>STA</span>
                                </label>
                              )}

                              {/* Column 3, Row 1: STA */}
                              {projectConfig.isFlat ? (
                                <label className="execution-scope-item" data-tooltip="Select this if full timing signoff is required across all modes and corners.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.factors.includes('sta')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.factors, 'sta']
                                        : projectConfig.fullChip.factors.filter(f => f !== 'sta');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, factors }
                                      });
                                    }}
                                  />
                                  <span>STA</span>
                                </label>
                              ) : (
                                <label className="execution-scope-item" data-tooltip="Select this if DFT needs to be done for this block or full chip.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.dft}
                                    onChange={(e) => {
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, dft: e.target.checked }
                                      });
                                    }}
                                  />
                                  <span>DFT</span>
                                </label>
                              )}

                              {/* Column 4, Row 1: Clock Distribution (for Flat) or mesh/MS-CTS (for Block + Full-Chip) or Low Power (for Full Chip only) */}
                              {projectConfig.isFlat ? (
                                <label className="execution-scope-item" data-tooltip="Select this if mesh or multi-source clock tree synthesis is required.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('clock_distribution')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'clock_distribution']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'clock_distribution');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>mesh/MS-CTS</span>
                                </label>
                              ) : projectConfig.isFullChipOnly ? (
                                <label className="execution-scope-item" data-tooltip="Select this if low-power features such as power gating are present in the design.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('low_power_full_chip')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'low_power_full_chip']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'low_power_full_chip');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>Low Power</span>
                                </label>
                              ) : (
                                <label className="execution-scope-item" data-tooltip="Select this if mesh or multi-source clock tree synthesis is required.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('clock_distribution')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'clock_distribution']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'clock_distribution');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>mesh/MS-CTS</span>
                                </label>
                              )}

                              {/* Column 5, Row 1: EM/IR analysis (only for Flat) */}
                              {projectConfig.isFlat && (
                                <label className="execution-scope-item" data-tooltip="Select this if power integrity checks for EM and IR drop are required.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.factors.includes('ir_drop')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.factors, 'ir_drop']
                                        : projectConfig.fullChip.factors.filter(f => f !== 'ir_drop');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, factors }
                                      });
                                    }}
                                  />
                                  <span>EM/IR analysis</span>
                                </label>
                              )}

                              {/* Row 2: Remaining items */}
                              {/* Column 1, Row 2: DFT */}
                              {projectConfig.isFlat ? (
                                <label className="execution-scope-item" data-tooltip="Select this if DFT needs to be done for this block or full chip.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.dft}
                                    onChange={(e) => {
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, dft: e.target.checked }
                                      });
                                    }}
                                  />
                                  <span>DFT</span>
                                </label>
                              ) : (
                                <label className="execution-scope-item" data-tooltip="Select this if the design contains analog or mixed-signal IPs that need integration.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('analog_ip_integration')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'analog_ip_integration']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'analog_ip_integration');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>Analog IP integration</span>
                                </label>
                              )}

                              {/* Column 2, Row 2: macro intensive (for Flat and Block + Full-Chip) or mesh/MS-CTS (for Full Chip only) */}
                              {projectConfig.isFlat ? (
                                <label className="execution-scope-item" data-tooltip="Select this if the design contains more than 100 macros (SRAMs or hard IPs).">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('macro_intensive')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'macro_intensive']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'macro_intensive');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>macro intensive</span>
                                </label>
                              ) : projectConfig.isFullChipOnly ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <label className="execution-scope-item" data-tooltip="Select this if the design contains more than 100 macros (SRAMs or hard IPs).">
                                    <input
                                      type="checkbox"
                                      checked={projectConfig.fullChip.percentageFactors.includes('macro_intensive')}
                                      onChange={(e) => {
                                        const factors = e.target.checked
                                          ? [...projectConfig.fullChip.percentageFactors, 'macro_intensive']
                                          : projectConfig.fullChip.percentageFactors.filter(f => f !== 'macro_intensive');
                                        markAsChanged();
                                        updateProjectConfig({
                                          ...projectConfig,
                                          fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                        });
                                      }}
                                    />
                                    <span>macro intensive</span>
                                  </label>
                                  <label className="execution-scope-item" data-tooltip="Select this if mesh or multi-source clock tree synthesis is required.">
                                    <input
                                      type="checkbox"
                                      checked={projectConfig.fullChip.percentageFactors.includes('clock_distribution')}
                                      onChange={(e) => {
                                        const factors = e.target.checked
                                          ? [...projectConfig.fullChip.percentageFactors, 'clock_distribution']
                                          : projectConfig.fullChip.percentageFactors.filter(f => f !== 'clock_distribution');
                                        markAsChanged();
                                        updateProjectConfig({
                                          ...projectConfig,
                                          fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                        });
                                      }}
                                    />
                                    <span>mesh/MS-CTS</span>
                                  </label>
                                </div>
                              ) : (
                                <label className="execution-scope-item" data-tooltip="Select this if the design contains more than 100 macros (SRAMs or hard IPs).">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('macro_intensive')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'macro_intensive']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'macro_intensive');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>macro intensive</span>
                                </label>
                              )}

                              {/* Column 3, Row 2: Merged mode SDC (for Flat and Block + Full-Chip) or EM/IR analysis (for Full Chip only) */}
                              {projectConfig.isFlat ? (
                                <label className="execution-scope-item" data-tooltip="Select this if a single SDC file is used to cover multiple modes and scenarios.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('merged_mode_constraints')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'merged_mode_constraints']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'merged_mode_constraints');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>Merged mode SDC</span>
                                </label>
                              ) : projectConfig.isFullChipOnly ? (
                                <label className="execution-scope-item" data-tooltip="Select this if power integrity checks for EM and IR drop are required.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.factors.includes('ir_drop')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.factors, 'ir_drop']
                                        : projectConfig.fullChip.factors.filter(f => f !== 'ir_drop');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, factors }
                                      });
                                    }}
                                  />
                                  <span>EM/IR analysis</span>
                                </label>
                              ) : (
                                <label className="execution-scope-item" data-tooltip="Select this if a single SDC file is used to cover multiple modes and scenarios.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('merged_mode_constraints')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'merged_mode_constraints']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'merged_mode_constraints');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>Merged mode SDC</span>
                                </label>
                              )}

                              {/* Column 4, Row 2: > 1 func mode (for Flat) or Abutment floorplan (for Full Chip) */}
                              {projectConfig.isFlat ? (
                                <label className="execution-scope-item" data-tooltip="Select this if the design operates in more than one functional mode.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('modes')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'modes']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'modes');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>&gt; 1 func mode</span>
                                </label>
                              ) : (
                                <label className="execution-scope-item" data-tooltip="Select this if the full chip is built by abutting blocks with/without top-level glue logic.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.percentageFactors.includes('abutment_floorplan')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.percentageFactors, 'abutment_floorplan']
                                        : projectConfig.fullChip.percentageFactors.filter(f => f !== 'abutment_floorplan');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                      });
                                    }}
                                  />
                                  <span>Abutment floorplan</span>
                                </label>
                              )}

                              {/* Column 5, Row 2: PV (Physical Verification) (only for Flat) */}
                              {projectConfig.isFlat && (
                                <label className="execution-scope-item" data-tooltip="Select this if DRC, LVS, and other signoff physical checks are required.">
                                  <input
                                    type="checkbox"
                                    checked={projectConfig.fullChip.factors.includes('pv')}
                                    onChange={(e) => {
                                      const factors = e.target.checked
                                        ? [...projectConfig.fullChip.factors, 'pv']
                                        : projectConfig.fullChip.factors.filter(f => f !== 'pv');
                                      markAsChanged();
                                      updateProjectConfig({
                                        ...projectConfig,
                                        fullChip: { ...projectConfig.fullChip, factors }
                                      });
                                    }}
                                  />
                                  <span>PV (Physical Verification)</span>
                                </label>
                              )}

                              {/* Row 3: Additional items for Full Chip only */}
                              {!projectConfig.isFlat && (
                                <>
                                  {/* Column 1, Row 3: > 1 func mode */}
                                  <label className="execution-scope-item" data-tooltip="Select this if the design operates in more than one functional mode.">
                                    <input
                                      type="checkbox"
                                      checked={projectConfig.fullChip.percentageFactors.includes('modes')}
                                      onChange={(e) => {
                                        const factors = e.target.checked
                                          ? [...projectConfig.fullChip.percentageFactors, 'modes']
                                          : projectConfig.fullChip.percentageFactors.filter(f => f !== 'modes');
                                        markAsChanged();
                                        updateProjectConfig({
                                          ...projectConfig,
                                          fullChip: { ...projectConfig.fullChip, percentageFactors: factors }
                                        });
                                      }}
                                    />
                                    <span>&gt; 1 func mode</span>
                                  </label>

                                  {/* Column 2, Row 3: PV (Physical Verification) */}
                                  <label className="execution-scope-item" data-tooltip="Select this if DRC, LVS, and other signoff physical checks are required.">
                                    <input
                                      type="checkbox"
                                      checked={projectConfig.fullChip.factors.includes('pv')}
                                      onChange={(e) => {
                                        const factors = e.target.checked
                                          ? [...projectConfig.fullChip.factors, 'pv']
                                          : projectConfig.fullChip.factors.filter(f => f !== 'pv');
                                        markAsChanged();
                                        updateProjectConfig({
                                          ...projectConfig,
                                          fullChip: { ...projectConfig.fullChip, factors }
                                        });
                                      }}
                                    />
                                    <span>PV (Physical Verification)</span>
                                  </label>

                                  {/* Column 3, Row 3: EM/IR analysis */}
                                  <label className="execution-scope-item" data-tooltip="Select this if power integrity checks for EM and IR drop are required.">
                                    <input
                                      type="checkbox"
                                      checked={projectConfig.fullChip.factors.includes('ir_drop')}
                                      onChange={(e) => {
                                        const factors = e.target.checked
                                          ? [...projectConfig.fullChip.factors, 'ir_drop']
                                          : projectConfig.fullChip.factors.filter(f => f !== 'ir_drop');
                                        markAsChanged();
                                        updateProjectConfig({
                                          ...projectConfig,
                                          fullChip: { ...projectConfig.fullChip, factors }
                                        });
                                      }}
                                    />
                                    <span>EM/IR analysis</span>
                                  </label>
                                </>
                              )}
                            </>
                          )}

                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DFT Configuration Section REMOVED - DFT Top Level is now only in Full Chip only section */}

            {/* Block Scope Definitions Section - Show for Block and Full-Chip projects, but NOT for Flat implementation or Full Chip Only */}
            {!projectConfig.isFlat && !projectConfig.isFullChipOnly && (
              <div id="block-config" className="form-section">
                <h2 style={{ color: '#0d7377' }}>Block Scope Definitions</h2>
                <p className="section-subtitle">
                  Block inputs that drive effort and cost estimation.
                </p>

                {projectConfig.blocks.length === 0 && (
                  <div className="no-blocks-message">
                    <p>No blocks configured. Enter a number above 0 to add blocks.</p>
                  </div>
                )}

                {projectConfig.blocks.length > 0 && (
                  <div className="blocks-table-container">
                    <div className="blocks-table-wrapper">
                      {/* Table Header Row */}
                      <div className="blocks-table-header">
                        <div className="blocks-table-cell header-cell">Block Name</div>
                        <div className="blocks-table-cell header-cell" data-tooltip="If instance count exceeds 4.5M, consider as a new block">Inst Count (Million) <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                        <div className="blocks-table-cell header-cell" data-tooltip="Planned number of RTL releases">RTL Drops <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                        <div className="blocks-table-cell header-cell" data-tooltip="Select the appropriate option based on whether the design has single or multiple power domains.">Power Domains <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                        <div className="blocks-table-cell header-cell" data-tooltip="Select New Design for first-time implementation, or Revision for an existing design update.">Design Maturity <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                        <div className="blocks-table-cell header-cell" data-tooltip="Select Flat for a single-block design, or Hierarchical for subsystem designs. Disabled for Block 1 (build first block first), mandatory from Block 2 onwards.">Design type <span style={{ color: '#e53e3e', marginLeft: '4px' }}>*</span></div>
                        <div className="blocks-table-cell header-cell" style={{ textAlign: 'center' }}>Design scope</div>
                      </div>

                      {/* Table Body - Each block is a row */}
                      {projectConfig.blocks.map((block, index) => {
                        const currentFactors = block.complexityFactors || [];
                        const hasNonNested = currentFactors.includes('low_power_non_nested');
                        const hasNested = currentFactors.includes('low_power_nested');
                        let currentSelection: string | null = null;
                        if (hasNested) currentSelection = 'nested';
                        else if (hasNonNested) currentSelection = 'non_nested';

                        const nonNestedFactor = (configuration?.blockComplexity || []).find(f => f.id === 'low_power_non_nested');
                        const nestedFactor = (configuration?.blockComplexity || []).find(f => f.id === 'low_power_nested');

                        const complexityFactorIds = [
                          'constraints_development',
                          'synthesis_complexity',
                          'new_design',
                          'physical_blocks',
                          'macro_intensive',
                          'io_blocks',
                          'merged_mode_constraints'
                        ];

                        return (
                          <div
                            key={index}
                            className="blocks-table-row"
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              }
                            }}
                          >
                            {/* Block Name */}
                            <div className="blocks-table-cell" onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              } else {
                                e.stopPropagation();
                              }
                            }}>
                              <input
                                type="text"
                                value={block.blockName || `Block ${index + 1}`}
                                onChange={(e) => updateBlock(index, { blockName: e.target.value })}
                                placeholder={`Block ${index + 1}`}
                                className="block-input block-name-input"
                              />
                            </div>

                            {/* Gate Count */}
                            <div className="blocks-table-cell" onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              } else {
                                e.stopPropagation();
                              }
                            }}>
                              <div className="inst-count-row">
                                <span className="mobile-only-label" style={{ fontSize: '12px', fontWeight: '600', color: '#1a202c' }}>Inst Count:</span>
                                <CustomDropdown
                                  value={block.gateCount || 1.0}
                                  onChange={(value) => updateBlock(index, { gateCount: value })}
                                  options={[
                                    { value: 1.0, label: '<1.5' },
                                    { value: 2.5, label: '<2.5' },
                                    { value: 3.5, label: '<3.5' },
                                    { value: 4.5, label: '<4.5' }
                                  ]}
                                />
                              </div>
                            </div>

                            {/* RTL Drops */}
                            <div className="blocks-table-cell" onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              } else {
                                e.stopPropagation();
                              }
                            }}>
                              <CustomDropdown
                                value={block.rtl_drop_count || 3}
                                onChange={(value) => updateBlock(index, { rtl_drop_count: value as 1 | 2 | 3 })}
                                options={[
                                  { value: 1, label: '1' },
                                  { value: 2, label: '2' },
                                  { value: 3, label: '3' }
                                ]}
                              />
                            </div>

                            {/* Power Domains - Vertical radio buttons */}
                            <div className="blocks-table-cell" onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              } else {
                                e.stopPropagation();
                              }
                            }}>
                              <div className="radio-column-group">
                                {[
                                  { value: 'none', label: 'None' },
                                  { value: 'non_nested', label: 'Non-nested' },
                                  { value: 'nested', label: 'Nested' }
                                ].map((option) => (
                                  <label
                                    key={option.value}
                                    className="radio-column-label"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      let factors: string[] = [...currentFactors];
                                      if (option.value === 'none') {
                                        factors = factors.filter(f => f !== 'low_power_non_nested' && f !== 'low_power_nested');
                                      } else if (option.value === 'non_nested') {
                                        factors = factors.filter(f => f !== 'low_power_non_nested' && f !== 'low_power_nested');
                                        factors.push('low_power_non_nested');
                                      } else if (option.value === 'nested') {
                                        factors = factors.filter(f => f !== 'low_power_non_nested' && f !== 'low_power_nested');
                                        factors.push('low_power_nested');
                                      }
                                      markAsChanged();
                                      updateBlock(index, { complexityFactors: factors });
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`power-domains-${index}`}
                                      value={option.value}
                                      checked={option.value === 'none' ? currentSelection === null : currentSelection === option.value}
                                      onChange={() => { }}
                                      onClick={(e) => e.preventDefault()}
                                    />
                                    <span>{option.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Design Maturity - Vertical radio buttons */}
                            <div className="blocks-table-cell" onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              } else {
                                e.stopPropagation();
                              }
                            }}>
                              <div className="radio-column-group">
                                {[
                                  { value: 'new_design', label: 'New Design' },
                                  { value: 'revision', label: 'Revision' }
                                ].map((option) => {
                                  const isChecked = currentFactors.includes(option.value);
                                  return (
                                    <label
                                      key={option.value}
                                      className="radio-column-label"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        let factors: string[] = [...currentFactors];
                                        factors = factors.filter(f => f !== 'new_design' && f !== 'revision');
                                        if (!isChecked) {
                                          factors.push(option.value);
                                        }
                                        markAsChanged();
                                        updateBlock(index, { complexityFactors: factors });
                                      }}
                                    >
                                      <input
                                        type="radio"
                                        name={`design-maturity-${index}`}
                                        value={option.value}
                                        checked={isChecked}
                                        onChange={() => { }}
                                        onClick={(e) => e.preventDefault()}
                                      />
                                      <span>{option.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Design type - Vertical radio buttons */}
                            {/* Block 1 (index 0): Disabled - must build first block first */}
                            {/* Block 2+ (index 1+): Mandatory - must select design type */}
                            <div className="blocks-table-cell" onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              } else {
                                e.stopPropagation();
                              }
                            }}>
                              <div className="radio-column-group" style={{ opacity: index === 0 ? 0.5 : 1, pointerEvents: index === 0 ? 'none' : 'auto' }}>
                                {[
                                  { value: 'flat', label: 'Flat' },
                                  { value: 'hierarchical', label: 'Hierarchical' }
                                ].map((option) => {
                                  const isChecked = currentFactors.includes(option.value);
                                  const isDisabled = index === 0; // Block 1 is disabled
                                  return (
                                    <label
                                      key={option.value}
                                      className="radio-column-label"
                                      style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                                      onClick={(e) => {
                                        if (isDisabled) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          return;
                                        }
                                        e.preventDefault();
                                        let factors: string[] = [...currentFactors];
                                        factors = factors.filter(f => f !== 'flat' && f !== 'hierarchical');
                                        if (!isChecked) {
                                          factors.push(option.value);
                                        }
                                        markAsChanged();
                                        updateBlock(index, { complexityFactors: factors });
                                      }}
                                    >
                                      <input
                                        type="radio"
                                        name={`design-type-${index}`}
                                        value={option.value}
                                        checked={isChecked}
                                        disabled={isDisabled}
                                        onChange={() => { }}
                                        onClick={(e) => {
                                          if (isDisabled) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          } else {
                                            e.preventDefault();
                                          }
                                        }}
                                      />
                                      <span>{option.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Design scope - Display 6 items with checkboxes in 2 columns (3 items each) */}
                            <div className="blocks-table-cell" onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (shouldShowCopyPopup(index, block, target)) {
                                setShowCopyPopup(index);
                              } else {
                                e.stopPropagation();
                              }
                            }}>
                              <div className="design-scope-list">
                                <div className="design-scope-column">
                                  {[
                                    { id: 'synthesis_complexity', label: 'Synthesis', tooltip: 'Select this if RTL-to-gate synthesis needs to be performed for this block or full chip.' },
                                    { id: 'macro_intensive', label: 'Macro intensive', tooltip: 'Select this if the design contains more than 100 macros (SRAMs or hard IPs).' },
                                    { id: 'io_blocks', label: 'IO included', tooltip: 'Select this if IO pad planning and IO integration are part of the scope.' }
                                  ].map((item) => {
                                    const isChecked = currentFactors.includes(item.id);
                                    return (
                                      <label key={item.id} className="design-scope-checkbox-label" data-tooltip={item.tooltip}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            let factors: string[] = [...currentFactors];
                                            if (e.target.checked) {
                                              if (!factors.includes(item.id)) {
                                                factors.push(item.id);
                                              }
                                            } else {
                                              factors = factors.filter(f => f !== item.id);
                                            }
                                            markAsChanged();
                                            updateBlock(index, { complexityFactors: factors });
                                          }}
                                        />
                                        <span>{item.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="design-scope-column">
                                  {[
                                    { id: 'physical_blocks', label: 'Any analog IPs', tooltip: 'Select this if the design contains analog or mixed-signal IPs that need integration.' },
                                    { id: 'merged_mode_constraints', label: 'Merged mode SDC', tooltip: 'Select this if a single SDC file is used to cover multiple modes and scenarios.' },
                                    { id: 'dft_block_level', label: 'DFT Ownership', checkDft: true, tooltip: 'Select this if DFT needs to be done for this block or full chip.' }
                                  ].map((item) => {
                                    const isChecked = item.checkDft
                                      ? (block.dft || currentFactors.includes('dft_block_level'))
                                      : currentFactors.includes(item.id);
                                    return (
                                      <label key={item.id} className="design-scope-checkbox-label" data-tooltip={item.tooltip}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            if (item.checkDft) {
                                              // When DFT is checked, update both dft field and add to complexityFactors
                                              let factors: string[] = [...currentFactors];
                                              if (e.target.checked) {
                                                if (!factors.includes('dft_block_level')) {
                                                  factors.push('dft_block_level');
                                                }
                                              } else {
                                                factors = factors.filter(f => f !== 'dft_block_level');
                                              }
                                              markAsChanged();
                                              updateBlock(index, {
                                                dft: e.target.checked,
                                                complexityFactors: factors
                                              });
                                            } else {
                                              let factors: string[] = [...currentFactors];
                                              if (e.target.checked) {
                                                if (!factors.includes(item.id)) {
                                                  factors.push(item.id);
                                                }
                                              } else {
                                                factors = factors.filter(f => f !== item.id);
                                              }
                                              markAsChanged();
                                              updateBlock(index, { complexityFactors: factors });
                                            }
                                          }}
                                        />
                                        <span>{item.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Toast Notification */}
        {
          saveMessage && (
            <Toast
              message={saveMessage.message}
              type={saveMessage.type}
              onClose={() => setSaveMessage(null)}
            />
          )
        }

        {/* Copy from Above Popup */}
        {
          showCopyPopup !== null && (
            <div className="copy-popup-overlay" onClick={() => setShowCopyPopup(null)}>
              <div className="copy-popup" onClick={(e) => e.stopPropagation()}>
                <h3>Copy Parameters?</h3>
                <p>Do you want to copy all parameters from Block {showCopyPopup} to Block {showCopyPopup + 1}?</p>
                <div className="copy-popup-buttons">
                  <button
                    className="copy-popup-btn copy-popup-confirm"
                    onClick={() => {
                      const previousBlock = projectConfig.blocks[showCopyPopup - 1];
                      if (previousBlock) {
                        updateBlock(showCopyPopup, {
                          gateCount: previousBlock.gateCount,
                          rtl_drop_count: previousBlock.rtl_drop_count,
                          complexityFactors: [...(previousBlock.complexityFactors || [])],
                          complexityFactorLevels: { ...(previousBlock.complexityFactorLevels || {}) },
                          dft: previousBlock.dft || false
                        });
                      }
                      setShowCopyPopup(null);
                    }}
                  >
                    Yes, Copy
                  </button>
                  <button
                    className="copy-popup-btn copy-popup-cancel"
                    onClick={() => {
                      // Mark this block as dismissed so popup won't show again
                      setDismissedCopyPopups(prev => new Set(prev).add(showCopyPopup));
                      setShowCopyPopup(null);
                    }}
                  >
                    No, Thanks
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Copy from Block 1 Popup for Full Chip */}
        {
          showFullChipCopyPopup && (
            <div className="copy-popup-overlay" onClick={() => setShowFullChipCopyPopup(false)}>
              <div className="copy-popup" onClick={(e) => e.stopPropagation()}>
                <h3>Copy Parameters?</h3>
                <p>Do you want to copy RTL Drops from Block 1 to Full Chip only?</p>
                <div className="copy-popup-buttons">
                  <button
                    className="copy-popup-btn copy-popup-confirm"
                    onClick={() => {
                      const firstBlock = projectConfig.blocks[0];
                      if (firstBlock && firstBlock.rtl_drop_count) {
                        markAsChanged();
                        updateProjectConfig({
                          ...projectConfig,
                          fullChip: {
                            ...projectConfig.fullChip,
                            rtl_drop_count: firstBlock.rtl_drop_count
                          }
                        });
                      }
                      setShowFullChipCopyPopup(false);
                    }}
                  >
                    Yes, Copy
                  </button>
                  <button
                    className="copy-popup-btn copy-popup-cancel"
                    onClick={() => setShowFullChipCopyPopup(false)}
                  >
                    No, Thanks
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Summary Modal */}
        {
          showSummaryModal && (
            <div className="copy-popup-overlay" onClick={() => setShowSummaryModal(false)}>
              <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
                <div className="summary-modal-header">
                  <h2>Project Summary</h2>
                  <button className="summary-close-btn" onClick={() => setShowSummaryModal(false)}>×</button>
                </div>

                <div className="summary-modal-content">
                  {/* Project Information */}
                  <div className="my-projects-detail-section">
                    <h3>Project Information</h3>
                    <div className="my-projects-detail-grid">
                      <div>
                        <strong>Target Application:</strong>
                        <p>{projectConfig.projectName || 'N/A'}</p>
                      </div>
                      <div>
                        <strong>Technology Node:</strong>
                        <p>{projectConfig.technology || 'Not Selected'}</p>
                      </div>
                      <div>
                        <strong>Engagement Scope:</strong>
                        <p>{projectConfig.fullChip.enabled ? 'Block + Full-Chip' : 'Block Development only'}</p>
                      </div>
                      <div>
                        <strong>Number of Blocks:</strong>
                        <p>{projectConfig.blocks.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Full Chip only */}
                  {projectConfig.fullChip.enabled && (
                    <div className="my-projects-detail-section">
                      <h3>Full Chip only</h3>
                      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        {/* RTL Drops - inline format */}
                        <div style={{ marginBottom: '16px' }}>
                          <strong style={{ color: '#64748b' }}>RTL Drops: </strong>
                          <span style={{ fontSize: '14px', color: '#1a202c', fontWeight: '500' }}>{projectConfig.fullChip.rtl_drop_count || 3}</span>
                        </div>

                        {/* Execution Scope - combine all factors */}
                        {((projectConfig.fullChip.factors && projectConfig.fullChip.factors.length > 0) ||
                          (projectConfig.fullChip.percentageFactors && projectConfig.fullChip.percentageFactors.some(f =>
                          (projectConfig.isFlat
                            ? ['low_power_full_chip', 'analog_ip_integration', 'clock_distribution', 'modes'].includes(f)
                            : ['low_power_full_chip', 'abutment_floorplan', 'analog_ip_integration', 'clock_distribution', 'modes'].includes(f)
                          )
                          )) ||
                          projectConfig.fullChip.dft) && (
                            <div style={{ marginBottom: '16px' }}>
                              <strong style={{ display: 'block', marginBottom: '8px', color: '#64748b' }}>Execution Scope:</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {/* Show factors (pnr, sta, ir_drop, pv) */}
                                {projectConfig.fullChip.factors && projectConfig.fullChip.factors.map((factor, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#e0f2fe',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      color: '#0369a1',
                                      fontWeight: '500'
                                    }}
                                  >
                                    {getFactorName(factor, true)}
                                  </span>
                                ))}
                                {/* Show percentageFactors that are in Execution scope grid */}
                                {projectConfig.fullChip.percentageFactors && projectConfig.fullChip.percentageFactors
                                  .filter(factor =>
                                    projectConfig.isFlat
                                      ? ['low_power_full_chip', 'analog_ip_integration', 'clock_distribution', 'modes'].includes(factor)
                                      : ['low_power_full_chip', 'abutment_floorplan', 'analog_ip_integration', 'clock_distribution', 'modes'].includes(factor)
                                  )
                                  .map((factor, idx) => (
                                    <span
                                      key={`pct-${idx}`}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#e0f2fe',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        color: '#0369a1',
                                        fontWeight: '500'
                                      }}
                                    >
                                      {getFactorName(factor, true)}
                                    </span>
                                  ))}
                                {/* Show DFT if enabled */}
                                {projectConfig.fullChip.dft && (
                                  <span
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#e0f2fe',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      color: '#0369a1',
                                      fontWeight: '500'
                                    }}
                                  >
                                    DFT
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                        {/* IO complexity */}
                        {projectConfig.fullChip.percentageFactorLevels && Object.keys(projectConfig.fullChip.percentageFactorLevels).length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <strong style={{ display: 'block', marginBottom: '8px', color: '#64748b' }}>IO complexity:</strong>
                            {Object.entries(projectConfig.fullChip.percentageFactorLevels).map(([factorKey, levelId]) => (
                              <p key={factorKey} style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>
                                {getFactorLevelLabel(factorKey, levelId, true)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Blocks Configuration */}
                  {projectConfig.blocks && projectConfig.blocks.length > 0 && (
                    <div className="my-projects-detail-section">
                      <h3>Block Configurations</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {projectConfig.blocks.map((block, index) => {
                          const complexityFactors = block.complexityFactors || [];
                          const lowPowerType = complexityFactors.includes('low_power_nested') ? 'nested' :
                            complexityFactors.includes('low_power_non_nested') ? 'non_nested' : 'none';
                          const hasNewDesign = complexityFactors.includes('new_design');
                          const hasRevision = complexityFactors.includes('revision');
                          const hasFlat = complexityFactors.includes('flat');
                          const hasHierarchical = complexityFactors.includes('hierarchical');
                          const designScopeFactors = complexityFactors.filter(f =>
                            !['low_power_nested', 'low_power_non_nested', 'new_design', 'revision', 'flat', 'hierarchical'].includes(f)
                          );

                          return (
                            <div
                              key={index}
                              style={{
                                padding: '20px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1FA2A8' }}>
                                {block.blockName || `Block ${index + 1}`}
                              </h4>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                  <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>Instance Count:</strong>
                                  <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>
                                    {block.gateCount || 1.0}M
                                  </p>
                                </div>
                                <div>
                                  <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>RTL Drops:</strong>
                                  <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>{block.rtl_drop_count || 3}</p>
                                </div>
                                <div>
                                  <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>Power Domains:</strong>
                                  <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>
                                    {lowPowerType === 'nested' ? 'Nested' : lowPowerType === 'non_nested' ? 'Non-nested' : 'None'}
                                  </p>
                                </div>
                                <div>
                                  <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>Design Maturity:</strong>
                                  <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>
                                    {hasNewDesign ? 'New Design' : hasRevision ? 'Revision' : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>Design Type:</strong>
                                  <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>
                                    {index === 0 ? 'N/A' : (hasFlat ? 'Flat' : hasHierarchical ? 'Hierarchical' : 'Not selected')}
                                  </p>
                                </div>
                                {block.dft && (
                                  <div>
                                    <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>DFT Ownership:</strong>
                                    <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>Enabled</p>
                                  </div>
                                )}
                              </div>

                              {/* Design Scope */}
                              {designScopeFactors.length > 0 && (
                                <div style={{ marginTop: '12px' }}>
                                  <strong style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '13px' }}>Design Scope:</strong>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {designScopeFactors.map((factor, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          padding: '6px 12px',
                                          backgroundColor: '#e0f2fe',
                                          borderRadius: '6px',
                                          fontSize: '13px',
                                          color: '#0369a1',
                                          fontWeight: '500'
                                        }}
                                      >
                                        {getFactorName(factor, false)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="summary-modal-footer">
                  <button
                    className="summary-btn summary-btn-cancel"
                    onClick={() => setShowSummaryModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="summary-btn summary-btn-confirm"
                    onClick={handleConfirm}
                    disabled={saving}
                  >
                    {saving ? 'Processing...' : 'Confirm & Calculate'}
                  </button>
                </div>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
};
