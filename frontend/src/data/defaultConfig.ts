import { Configuration } from '../types';

export const defaultConfiguration: Configuration = {
  blockTimeline: [
    {
      id: 'timeline-1',
      name: '3 RTL Drops',
      rtl_drop_count: 3,
      months: 6,
      notes: 'Maximum iterations'
    },
    {
      id: 'timeline-2',
      name: '2 RTL Drops',
      rtl_drop_count: 2,
      months: 4,
      notes: 'Typical approach'
    },
    {
      id: 'timeline-3',
      name: '1 RTL Drop',
      rtl_drop_count: 1,
      months: 2,
      notes: 'Fast track/simple designs'
    }
  ],
  fullChipTimeline: [
    {
      id: 'timeline-1',
      name: '3 RTL Drops',
      rtl_drop_count: 3,
      months: 7,
      notes: 'Maximum iterations'
    },
    {
      id: 'timeline-2',
      name: '2 RTL Drops',
      rtl_drop_count: 2,
      months: 5,
      notes: 'Typical approach'
    },
    {
      id: 'timeline-3',
      name: '1 RTL Drop',
      rtl_drop_count: 1,
      months: 3,
      notes: 'Fast track/simple designs'
    }
  ],
  blockGateCount: {
    baseGateCount: 1.5,
    baseResource: 0.5,
    gateIncrementStep: 1.0,
    additionalResourcePercentage: 2,
    maxGateCount: 4.5
  },
  blockComplexity: [
    {
      id: 'constraints_development',
      name: 'Constraints Development',
      resourcePercentage: 10,
      notes: 'SDC, timing constraints',
      enabled: true
    },
    {
      id: 'synthesis_complexity',
      name: 'Synthesis',
      resourcePercentage: 5,
      notes: 'Yes / No',
      enabled: true
    },
    {
      id: 'new_design',
      name: 'New Design',
      resourcePercentage: 5,
      notes: 'No previous tape-out',
      enabled: true
    },
    {
      id: 'low_power_non_nested',
      name: 'Low Power - Non-nested',
      resourcePercentage: 10,
      notes: 'Single level power domains',
      enabled: true
    },
    {
      id: 'low_power_nested',
      name: 'Low Power - Nested',
      resourcePercentage: 30,
      notes: 'Multi-level power domains',
      enabled: true
    },
    {
      id: 'physical_blocks',
      name: 'Analog IPs',
      resourcePercentage: 30,
      notes: 'Analog/mixed-signal blocks',
      enabled: true
    },
    {
      id: 'macro_intensive',
      name: 'Macro Intensive',
      resourcePercentage: 2,
      notes: 'High macro density (>100)',
      enabled: true
    },
    {
      id: 'io_blocks',
      name: 'IO Blocks',
      resourcePercentage: 20,
      notes: 'Complex IO constraints',
      enabled: true
    },
    {
      id: 'merged_mode_constraints',
      name: 'Merged Mode Constraints',
      resourcePercentage: 5,
      notes: 'Multiple operation modes',
      enabled: true
    },
    {
      id: 'hierarchical',
      name: 'Hierarchical',
      resourcePercentage: 100,
      notes: 'Dealing sub blocks',
      enabled: true
    },
    {
      id: 'dft_block_level',
      name: 'DFT - Block Level',
      resourcePercentage: 60,
      notes: 'Per block DFT',
      enabled: true
    }
  ],
  fullChip: {
    fixed: [
      {
        id: 'pnr',
        name: 'PnR (Place & Route)',
        resources: 1.0,
        notes: 'Placement, routing, optimization'
      },
      {
        id: 'ir-drop', // Keeping hyphenated version if that's what frontend uses, but noting backend used underscore
        name: 'IR Drop Analysis',
        resources: 0.5,
        notes: 'Power integrity'
      },
      {
        id: 'pv',
        name: 'PV (Physical Verification)',
        resources: 1.0,
        notes: 'DRC, LVS, antenna'
      },
      {
        id: 'sta',
        name: 'STA',
        resources: 1.0,
        notes: 'Multi-corner analysis'
      }
    ],
    percentage: [
      {
        id: 'low_power_non_nested_full_chip',
        name: 'Low Power - Non-nested (Full Chip)',
        resourcePercentage: 5,
        notes: 'Single level power domains',
        enabled: true
      },
      {
        id: 'low_power_nested_full_chip',
        name: 'Low Power - Nested (Full Chip)',
        resourcePercentage: 10,
        notes: 'Multi-level power domains',
        enabled: true
      },
      {
        id: 'synthesis', // Keeping backend consistent: backend has synthesis_full_chip but referenced as 'synthesis' here? Let's check original.
        name: 'Synthesis',
        resourcePercentage: 5,
        notes: 'Full chip synthesis',
        enabled: true
      },
      {
        id: 'analog_ip_integration',
        name: 'Analog IP Integration',
        resourcePercentage: 10,
        notes: 'Placement, lib, custom routing',
        enabled: true
      },
      {
        id: 'abutment-floorplan',
        name: 'Abutment Floorplan',
        resourcePercentage: 10,
        notes: 'Feedthrough planning',
        enabled: true
      },
      {
        id: 'modes',
        name: 'Modes',
        resourcePercentage: 10,
        notes: 'Additional IO modes',
        enabled: true
      },
      {
        id: 'blocks-count',
        name: 'Blocks Scaling',
        resourcePercentage: 0,
        notes: 'Auto-derived from number of blocks: ≤8=0%, 9-18=10%, >18=20%',
        enabled: true,
        autoApplied: true,
        levels: [
          {
            id: 'none',
            label: '≤8 blocks',
            resourcePercentage: 0,
            notes: '≤8 blocks'
          },
          {
            id: '9-18',
            label: '9-18 blocks',
            resourcePercentage: 10,
            notes: '9-18 blocks'
          },
          {
            id: '18-plus',
            label: '>18 blocks',
            resourcePercentage: 20,
            notes: 'More than 18 blocks'
          }
        ]
      },
      {
        id: 'clock_distribution',
        name: 'Clock Distribution',
        resourcePercentage: 30,
        notes: 'Complex: Mesh/Multi-source',
        enabled: true
      },
      {
        id: 'io_pad_count',
        name: 'I/O Pad Cell Count',
        resourcePercentage: 0,
        notes: 'I/O pad cell count multiplier',
        enabled: true,
        levels: [
          {
            id: 'low',
            label: 'Low: <50 pads',
            resourcePercentage: 0,
            notes: 'Simple digital pads',
            locked: true
          },
          {
            id: 'medium',
            label: 'Medium: 50-150 pads',
            resourcePercentage: 10,
            notes: 'Mixed digital/analog pads',
            locked: true
          },
          {
            id: 'high',
            label: 'High: >150 pads',
            resourcePercentage: 15,
            notes: 'Complex, ESD, multiple types',
            locked: false
          }
        ]
      },
      {
        id: 'dft-top-level',
        name: 'DFT - Top Level',
        resourcePercentage: 30,
        notes: 'Full chip DFT',
        enabled: true
      }
    ]
  },
  dft: {
    cadFlow: {
      id: 'dft-cad',
      name: 'DFT - CAD/Flow',
      resources: 1.0,
      notes: 'Fixed resources applied once per project if any DFT is enabled'
    }
  },
  costPerResourcePerMonth: 400000, // 4L per month
  technologyNodeMultipliers: {
    '2nm': 0.15,
    '3nm': 0.13,
    '5nm': 0.11,
    '7nm': 0.09,
    '10nm': 0.07,
    '12nm': 0.07,
    '14nm': 0.05,
    '16nm': 0.05,
    '22nm': 0.03,
    '28nm': 0.02,
    '32nm': 0.02,
    '40nm': 0.01,
    '45nm': 0.01,
    '65nm': 0.0,
    '90nm': 0.0,
    '130nm': 0.0,
  }
};

