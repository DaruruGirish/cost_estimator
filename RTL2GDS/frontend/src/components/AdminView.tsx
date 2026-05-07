import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { Configuration } from '../types';
import { Header } from './Header';
import { Toast } from './Toast';
import { MyProjectsModal } from './MyProjectsModal';
import { BLOCK_COMPLEXITY_FACTOR_SCHEMA } from '../data/blockComplexitySchema';
import { apiService } from '../services/api';
import './AdminView.css';

interface AdminViewProps {
  onRoleChange?: (role: 'admin' | 'customer') => void;
  currentRole?: 'admin' | 'customer';
}

export const AdminView = ({ onRoleChange: _onRoleChange, currentRole: _currentRole }: AdminViewProps = {}) => {
  const { configuration, updateConfiguration, loading, error } = useConfig();
  const [localConfig, setLocalConfig] = useState<Configuration>(configuration);
  const [activeTab, setActiveTab] = useState<string>('timeline');
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loadingProjectDetails, setLoadingProjectDetails] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const projectsPerPage = 15;
  const [sortBy, setSortBy] = useState<string>('date-desc'); // Default: newest first
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterCostMin, setFilterCostMin] = useState<string>('');
  const [filterCostMax, setFilterCostMax] = useState<string>('');
  const [filterDurationMin, setFilterDurationMin] = useState<string>('');
  const [filterDurationMax, setFilterDurationMax] = useState<string>('');
  const [editDefaults, setEditDefaults] = useState<Record<string, boolean>>({
    timeline: false,
    'block-gate': false,
    'block-complexity': false,
    fullchip: false,
    cost: false
  });
  const [showSaveConfirmation, setShowSaveConfirmation] = useState<boolean>(false);
  const [pendingSaveSection, setPendingSaveSection] = useState<string | null>(null);

  // Redirect from deprecated 'dft' tab to 'timeline' if needed
  useEffect(() => {
    if (activeTab === 'dft') {
      setActiveTab('timeline');
    }
  }, [activeTab]);

  useEffect(() => {
    if (configuration && (configuration.blockTimeline || configuration.fullChipTimeline)) {
      // Normalize configuration before setting local state
      const existingBlockGateCount = configuration.blockGateCount || {};
      
      // Normalize full chip percentage factors - ensure clock_distribution (mesh/MS-CTS) defaults to 30%
      const normalizedFullChipPercentage = (configuration.fullChip?.percentage || []).map(factor => {
        if (factor.id === 'clock_distribution') {
          return {
            ...factor,
            name: 'mesh/MS-CTS', // Ensure name is correct
            levels: undefined, // Remove levels for clock_distribution
            resourcePercentage: (factor.resourcePercentage && factor.resourcePercentage > 0) ? factor.resourcePercentage : 30 // Default to 30% if 0, null, or undefined
          };
        }
        return factor;
      });
      
      const normalizedConfig: Configuration = {
        ...configuration,
        blockGateCount: {
          baseGateCount: (existingBlockGateCount.baseGateCount != null && existingBlockGateCount.baseGateCount > 0)
            ? existingBlockGateCount.baseGateCount
            : 1.5,
          baseResource: (existingBlockGateCount.baseResource != null && existingBlockGateCount.baseResource > 0)
            ? existingBlockGateCount.baseResource
            : 0.5,
          gateIncrementStep: (existingBlockGateCount.gateIncrementStep != null && existingBlockGateCount.gateIncrementStep > 0)
            ? existingBlockGateCount.gateIncrementStep
            : 1.0,
          additionalResourcePercentage: (existingBlockGateCount.additionalResourcePercentage != null && existingBlockGateCount.additionalResourcePercentage >= 0)
            ? existingBlockGateCount.additionalResourcePercentage
            : 10,
          maxGateCount: (existingBlockGateCount.maxGateCount != null && existingBlockGateCount.maxGateCount > 0)
            ? existingBlockGateCount.maxGateCount
            : 4.0,
        },
        fullChip: {
          ...configuration.fullChip,
          percentage: normalizedFullChipPercentage
        },
        dftContextPercentages: configuration.dftContextPercentages || {
          dftAlone: 60,
          dftWithIoOrAnalog: 70,
          dftWithIoAndAnalog: 80,
        },
      };
      setLocalConfig(normalizedConfig);
    }
  }, [configuration]);

  // Load projects when projects tab is active
  useEffect(() => {
    if (activeTab === 'projects') {
      loadProjects();
    }
  }, [activeTab]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Reset editDefaults when switching tabs (optional - can keep state per tab)
  // We'll keep state per section, so no reset needed

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const data = await apiService.getAllProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      setToast({
        message: err?.message || 'Failed to load projects',
        type: 'error'
      });
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingProjectId(projectId);
      await apiService.deleteProject(projectId);
      setToast({ message: 'Project deleted successfully', type: 'success' });
      // Reload projects list
      await loadProjects();
    } catch (err: any) {
      console.error('Failed to delete project:', err);
      setToast({
        message: err?.message || 'Failed to delete project',
        type: 'error'
      });
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleViewProject = async (projectId: number) => {
    try {
      setLoadingProjectDetails(true);
      const projectDetails = await apiService.getProjectById(projectId);
      setSelectedProject(projectDetails);
      setShowProjectModal(true);
    } catch (err: any) {
      console.error('Failed to load project details:', err);
      setToast({
        message: err?.message || 'Failed to load project details',
        type: 'error'
      });
    } finally {
      setLoadingProjectDetails(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount || amount === 0) return '₹0';
    // Show full number with Indian number formatting (commas)
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    const d = new Date(date);

    // Format date only (no time) in IST
    // Manual IST conversion (UTC+5:30) to get correct date
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(d.getTime() + istOffset);

    // Format using UTC methods after adding offset
    const year = istTime.getUTCFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[istTime.getUTCMonth()];
    const day = istTime.getUTCDate();

    return `${day} ${month} ${year}`;
  };

  const handleSaveSection = async (sectionName: string, skipConfirmation: boolean = false) => {
    try {
      // Check if we need to show confirmation dialog when editDefaults is enabled for any section
      if (editDefaults[sectionName] && !skipConfirmation) {
        setPendingSaveSection(sectionName);
        setShowSaveConfirmation(true);
        return;
      }

      setSavingSection(sectionName);

      // Ensure all required fields are present with defaults before saving
      // Always create a complete blockGateCount object with all required fields
      const existingBlockGateCount = localConfig.blockGateCount || {};
      const blockGateCount = {
        baseGateCount: (existingBlockGateCount.baseGateCount != null && existingBlockGateCount.baseGateCount > 0)
          ? existingBlockGateCount.baseGateCount
          : 1.5,
        baseResource: (existingBlockGateCount.baseResource != null && existingBlockGateCount.baseResource > 0)
          ? existingBlockGateCount.baseResource
          : 0.5,
        gateIncrementStep: (existingBlockGateCount.gateIncrementStep != null && existingBlockGateCount.gateIncrementStep > 0)
          ? existingBlockGateCount.gateIncrementStep
          : 1.0,
        additionalResourcePercentage: (existingBlockGateCount.additionalResourcePercentage != null && existingBlockGateCount.additionalResourcePercentage >= 0)
          ? existingBlockGateCount.additionalResourcePercentage
          : 10,
        maxGateCount: (existingBlockGateCount.maxGateCount != null && existingBlockGateCount.maxGateCount > 0)
          ? existingBlockGateCount.maxGateCount
          : 4.0,
      };

      // Verify blockGateCount is complete before sending
      if (!blockGateCount.baseGateCount || blockGateCount.baseGateCount <= 0) {
        console.error('Invalid blockGateCount before save:', blockGateCount);
        throw new Error('Block Gate Count configuration is invalid');
      }

      // IMPORTANT: When saving a specific section, preserve existing configuration from server
      // Use current configuration as base to avoid overwriting other sections with incomplete data
      const baseConfig = configuration || localConfig;

      // Construct config explicitly to avoid spreading incomplete objects
      const configToSave: Configuration = {
        blockTimeline: sectionName === 'timeline' ? (localConfig.blockTimeline || []) : (baseConfig.blockTimeline || []),
        fullChipTimeline: sectionName === 'timeline' ? (localConfig.fullChipTimeline || []) : (baseConfig.fullChipTimeline || []),
        blockGateCount: sectionName === 'block-gate' ? blockGateCount : (baseConfig.blockGateCount || blockGateCount),
        blockComplexity: (() => {
          // Normalize blockComplexity to only include { factor_id, enabled, multiplier_percentage }
          // Use schema to ensure all factors are present with correct names/descriptions
          if (sectionName === 'block-complexity') {
            return BLOCK_COMPLEXITY_FACTOR_SCHEMA.map(schema => {
              const existingConfig = localConfig.blockComplexity.find(f => f.id === schema.id);
              return {
                id: schema.id,
                name: schema.name, // Keep name for display, but it's non-editable
                resourcePercentage: existingConfig?.resourcePercentage ?? schema.defaultMultiplier,
                notes: schema.description, // Keep notes for display, but it's non-editable
                enabled: existingConfig?.enabled ?? (schema.autoApplied ? true : false),
                autoApplied: schema.autoApplied
              };
            });
          }
          return baseConfig.blockComplexity || localConfig.blockComplexity || [];
        })(),
        fullChip: sectionName === 'fullchip' ? (() => {
          const fullChipConfig = localConfig.fullChip || { fixed: [], percentage: [] };
          // Remove levels from clock_distribution (mesh/MS-CTS) to convert it to a simple percentage factor
          // Also ensure default resourcePercentage is 30% for clock_distribution and name is correct
          const cleanedPercentage = fullChipConfig.percentage.map(factor => {
            if (factor.id === 'clock_distribution') {
              return { 
                ...factor, 
                name: 'mesh/MS-CTS', // Ensure name is correct
                levels: undefined,
                resourcePercentage: (factor.resourcePercentage && factor.resourcePercentage > 0) ? factor.resourcePercentage : 30
              };
            }
            return factor;
          });
          return { ...fullChipConfig, percentage: cleanedPercentage };
        })() : (baseConfig.fullChip || {
          fixed: [],
          percentage: [],
        }),
        dft: baseConfig.dft || {
          cadFlow: { id: 'dft-cad', name: 'DFT CAD/Flow', resources: 0, notes: 'DEPRECATED' },
        },
        dftContextPercentages: sectionName === 'block-complexity'
          ? (localConfig.dftContextPercentages || baseConfig.dftContextPercentages || {
            dftAlone: 60,
            dftWithIoOrAnalog: 70,
            dftWithIoAndAnalog: 80,
          })
          : (baseConfig.dftContextPercentages || localConfig.dftContextPercentages),
        costPerResourcePerMonth: sectionName === 'cost' ? (localConfig.costPerResourcePerMonth || 400000) : (baseConfig.costPerResourcePerMonth || 400000),
        technologyNodeMultipliers: baseConfig.technologyNodeMultipliers || localConfig.technologyNodeMultipliers || {},
        additionalFactors: baseConfig.additionalFactors || localConfig.additionalFactors || [],
      };

      // Log what we're sending for debugging
      console.log('Saving section:', sectionName);
      console.log('blockGateCount being sent:', configToSave.blockGateCount);

      await updateConfiguration(configToSave);
      // Show success message for the specific section
      const sectionDisplayNames: Record<string, string> = {
        'timeline': 'Project Timeline',
        'block-gate': 'Block Gate Count',
        'block-complexity': 'Block Complexity',
        'fullchip': 'Full Chip',
        'cost': 'Cost Settings',
      };
      setToast({
        message: `${sectionDisplayNames[sectionName] || sectionName} saved successfully!`,
        type: 'success'
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to save configuration. Please try again.';
      console.error('Save section error:', err);
      setToast({ message: `Failed to save: ${errorMessage}`, type: 'error' });
    } finally {
      setSavingSection(null);
    }
  };


  // Safety check - ensure configuration is loaded
  if (loading) {
    return (
      <div className="admin-view">
        <div className="admin-sidebar">
        </div>
        <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)' }}>
          <Header title="Admin Configuration Panel" />
          <div className="admin-container">
            <div className="admin-content">
              <p>Loading configuration...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-view">
        <div className="admin-sidebar">
        </div>
        <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)' }}>
          <Header title="Admin Configuration Panel" />
          <div className="admin-container">
            <div className="admin-content">
              <p>Error loading configuration: {error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!localConfig.blockTimeline || !localConfig.fullChipTimeline) {
    return (
      <div className="admin-view">
        <div className="admin-sidebar">
        </div>
        <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)' }}>
          <Header title="Admin Configuration Panel" />
          <div className="admin-container">
            <div className="admin-content">
              <p>Configuration not properly initialized. Please refresh the page.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-view">
      <div className="admin-sidebar">
        <button
          className={`sidebar-item ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <span>📅</span>
          <span>Project Timeline</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'block-gate' ? 'active' : ''}`}
          onClick={() => setActiveTab('block-gate')}
        >
          <span>🔢</span>
          <span>Block Gate Count</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'block-complexity' ? 'active' : ''}`}
          onClick={() => setActiveTab('block-complexity')}
        >
          <span>⚙️</span>
          <span>Block Complexity</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'fullchip' ? 'active' : ''}`}
          onClick={() => setActiveTab('fullchip')}
        >
          <span>🔲</span>
          <span>Full Chip</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'cost' ? 'active' : ''}`}
          onClick={() => setActiveTab('cost')}
        >
          <span>💰</span>
          <span>Cost Settings</span>
        </button>
        <button
          className={`sidebar-item ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <span>📋</span>
          <span>Projects</span>
        </button>
      </div>

      <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', display: 'flex', flexDirection: 'column' }}>
        <Header
          title="Admin Configuration Panel"
        />
        <div className="admin-container">
          <div className="admin-content">
            {activeTab === 'timeline' && (
              <>
                <div key="block-timeline" className="config-section">
                  <h2>Block Timeline</h2>
                  {localConfig.blockTimeline?.map((timeline, index) => (
                    <div key={timeline.id} className="config-item">
                      <div className="form-group">
                        <label>RTL Drop Count</label>
                        <select
                          value={timeline.rtl_drop_count}
                          onChange={(e) => {
                            const newTimeline = [...(localConfig.blockTimeline || [])];
                            const rtlDropCount = parseInt(e.target.value) as 1 | 2 | 3;
                            newTimeline[index] = {
                              ...newTimeline[index],
                              rtl_drop_count: rtlDropCount,
                              name: `${rtlDropCount} RTL Drop${rtlDropCount > 1 ? 's' : ''}` // Auto-generate name
                            };
                            setLocalConfig({ ...localConfig, blockTimeline: newTimeline });
                          }}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Duration (Months)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.1"
                          value={timeline.months ?? 0}
                          onChange={(e) => {
                            const newTimeline = [...(localConfig.blockTimeline || [])];
                            newTimeline[index] = { ...newTimeline[index], months: parseFloat(e.target.value) || 0 };
                            setLocalConfig({ ...localConfig, blockTimeline: newTimeline });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div key="fullchip-timeline" className="config-section">
                  <h2>Full Chip Timeline</h2>
                  {localConfig.fullChipTimeline?.map((timeline, index) => (
                    <div key={timeline.id} className="config-item">
                      <div className="form-group">
                        <label>RTL Drop Count</label>
                        <select
                          value={timeline.rtl_drop_count}
                          onChange={(e) => {
                            const newTimeline = [...(localConfig.fullChipTimeline || [])];
                            const rtlDropCount = parseInt(e.target.value) as 1 | 2 | 3;
                            newTimeline[index] = {
                              ...newTimeline[index],
                              rtl_drop_count: rtlDropCount,
                              name: `${rtlDropCount} RTL Drop${rtlDropCount > 1 ? 's' : ''}` // Auto-generate name
                            };
                            setLocalConfig({ ...localConfig, fullChipTimeline: newTimeline });
                          }}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Duration (Months)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.1"
                          value={timeline.months ?? 0}
                          onChange={(e) => {
                            const newTimeline = [...(localConfig.fullChipTimeline || [])];
                            newTimeline[index] = { ...newTimeline[index], months: parseFloat(e.target.value) || 0 };
                            setLocalConfig({ ...localConfig, fullChipTimeline: newTimeline });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div key="timeline-save-button" className="section-save-button" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={() => setEditDefaults({ ...editDefaults, timeline: !editDefaults.timeline })}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      border: `2px solid ${editDefaults.timeline ? '#0369a1' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      backgroundColor: editDefaults.timeline ? '#0369a1' : 'white',
                      color: editDefaults.timeline ? 'white' : '#1a202c',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                  >
                    {editDefaults.timeline ? '✓ Edit Defaults Enabled' : 'Edit Defaults'}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => handleSaveSection('timeline')}
                    disabled={savingSection === 'timeline' || loading}
                  >
                    {savingSection === 'timeline' ? 'Saving...' : 'Save Project Timeline'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'block-gate' && (
              <div className="config-section">
                <h2>Block Gate Count</h2>
                <div className="form-group">
                  <label>Base Gate Count (Million)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={localConfig.blockGateCount.baseGateCount}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      blockGateCount: {
                        ...localConfig.blockGateCount,
                        baseGateCount: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                  <p className="help-text">Default: &lt;1.5</p>
                </div>
                {/* Base Resource and Gate Increment Step removed as they are unused/hardcoded */}
                <div className="form-group">
                  <label>Additional Resource Percentage</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={localConfig.blockGateCount.additionalResourcePercentage}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      blockGateCount: {
                        ...localConfig.blockGateCount,
                        additionalResourcePercentage: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                  <p className="help-text">% effort added per increment step. Default: 10</p>
                </div>
                {/* Max Gate Count removed as requested */}
                <div className="section-save-button" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={() => setEditDefaults({ ...editDefaults, 'block-gate': !editDefaults['block-gate'] })}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      border: `2px solid ${editDefaults['block-gate'] ? '#0369a1' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      backgroundColor: editDefaults['block-gate'] ? '#0369a1' : 'white',
                      color: editDefaults['block-gate'] ? 'white' : '#1a202c',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                  >
                    {editDefaults['block-gate'] ? '✓ Edit Defaults Enabled' : 'Edit Defaults'}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => handleSaveSection('block-gate')}
                    disabled={savingSection === 'block-gate' || loading}
                  >
                    {savingSection === 'block-gate' ? 'Saving...' : 'Save Block Gate Count'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'block-complexity' && (
              <div className="config-section">
                <h2>Block Complexity Factors</h2>
                <p className="help-text" style={{ marginBottom: '24px' }}>
                  Fixed list of predefined block complexity factors organized by category. Factor names and descriptions are non-editable.
                  Configure enable/disable status and multiplier percentages only.
                  <br /><strong>Note:</strong> Admin can enable both Low Power options simultaneously. Mutual exclusivity is enforced only in Customer UI.
                </p>

                {/* Helper function to render a factor card */}
                {(() => {
                  const renderFactorCard = (schema: typeof BLOCK_COMPLEXITY_FACTOR_SCHEMA[0]) => {
                    const factorConfig = localConfig.blockComplexity.find(f => f.id === schema.id);
                    const enabled = factorConfig?.enabled ?? (schema.autoApplied ? true : false);
                    const multiplierPercentage = factorConfig?.resourcePercentage ?? schema.defaultMultiplier;

                    return (
                      <div
                        key={schema.id}
                        className="block-complexity-card"
                        style={{
                          padding: '24px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '12px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#0369a1';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(3, 105, 161, 0.15)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* Factor Name */}
                        <h3 style={{
                          margin: 0,
                          fontSize: '17px',
                          fontWeight: '600',
                          color: '#1e293b',
                          letterSpacing: '-0.01em'
                        }}>
                          {schema.name}
                        </h3>

                        {/* Multiplier Percentage Input */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#64748b'
                          }}>
                            Multiplier Percentage (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={multiplierPercentage || ''}
                            onChange={(e) => {
                              const newComplexity = [...localConfig.blockComplexity];
                              // Allow empty string to result in 0, but handle NaN/invalid properly
                              const val = e.target.value;
                              const newValue = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);

                              const existingIndex = newComplexity.findIndex(f => f.id === schema.id);

                              if (existingIndex >= 0) {
                                newComplexity[existingIndex] = {
                                  ...newComplexity[existingIndex],
                                  resourcePercentage: newValue
                                };
                              } else {
                                newComplexity.push({
                                  id: schema.id,
                                  name: schema.name,
                                  resourcePercentage: newValue,
                                  notes: schema.description,
                                  enabled: enabled
                                });
                              }

                              setLocalConfig({ ...localConfig, blockComplexity: newComplexity });
                            }}
                            disabled={!enabled}
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              fontSize: '15px',
                              border: '2px solid #cbd5e1',
                              borderRadius: '8px',
                              backgroundColor: enabled !== false ? '#ffffff' : '#f1f5f9',
                              color: '#1e293b',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              if (enabled !== false) {
                                e.target.style.borderColor = '#0369a1';
                                e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                              }
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#cbd5e1';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {/* Power Domains Section */}
                      <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: '700',
                          color: '#ffffff',
                          marginBottom: '20px',
                          padding: '16px 20px',
                          backgroundColor: '#0369a1',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(3, 105, 161, 0.2)',
                          letterSpacing: '-0.01em'
                        }}>
                          Power Domains
                        </h3>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                          gap: '20px'
                        }}>
                          {BLOCK_COMPLEXITY_FACTOR_SCHEMA.filter(schema =>
                            schema.id === 'low_power_non_nested' || schema.id === 'low_power_nested'
                          ).map((schema) => renderFactorCard(schema))}
                        </div>
                      </div>

                      {/* Design Maturity Section */}
                      <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: '700',
                          color: '#ffffff',
                          marginBottom: '20px',
                          padding: '16px 20px',
                          backgroundColor: '#0369a1',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(3, 105, 161, 0.2)',
                          letterSpacing: '-0.01em'
                        }}>
                          Design Maturity
                        </h3>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                          gap: '20px'
                        }}>
                          {BLOCK_COMPLEXITY_FACTOR_SCHEMA.filter(schema =>
                            schema.id === 'new_design'
                          ).map((schema) => renderFactorCard(schema))}
                        </div>
                      </div>

                      {/* Design Type Section */}
                      <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: '700',
                          color: '#ffffff',
                          marginBottom: '20px',
                          padding: '16px 20px',
                          backgroundColor: '#0369a1',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(3, 105, 161, 0.2)',
                          letterSpacing: '-0.01em'
                        }}>
                          Design Type
                        </h3>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                          gap: '20px'
                        }}>
                          {BLOCK_COMPLEXITY_FACTOR_SCHEMA.filter(schema =>
                            schema.id === 'synthesis_complexity'
                          ).map((schema) => renderFactorCard(schema))}
                        </div>
                      </div>

                      {/* Design Scope Section */}
                      <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: '700',
                          color: '#ffffff',
                          marginBottom: '20px',
                          padding: '16px 20px',
                          backgroundColor: '#0369a1',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(3, 105, 161, 0.2)',
                          letterSpacing: '-0.01em'
                        }}>
                          Design Scope
                        </h3>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                          gap: '20px'
                        }}>
                          {BLOCK_COMPLEXITY_FACTOR_SCHEMA.filter(schema =>
                            schema.id === 'macro_intensive' ||
                            schema.id === 'io_blocks' ||
                            schema.id === 'physical_blocks' ||
                            schema.id === 'merged_mode_constraints' ||
                            schema.id === 'dft_block_level'
                          ).map((schema) => renderFactorCard(schema))}
                        </div>
                      </div>

                      {/* Other Factors Section */}
                      {BLOCK_COMPLEXITY_FACTOR_SCHEMA.filter(schema =>
                        schema.id !== 'low_power_non_nested' &&
                        schema.id !== 'low_power_nested' &&
                        schema.id !== 'new_design' &&
                        schema.id !== 'synthesis_complexity' &&
                        schema.id !== 'macro_intensive' &&
                        schema.id !== 'io_blocks' &&
                        schema.id !== 'physical_blocks' &&
                        schema.id !== 'merged_mode_constraints' &&
                        schema.id !== 'dft_block_level' &&
                        schema.id !== 'constraints_development'
                      ).length > 0 && (
                          <div style={{ marginBottom: '32px' }}>
                            <h3 style={{
                              fontSize: '20px',
                              fontWeight: '700',
                              color: '#ffffff',
                              marginBottom: '20px',
                              padding: '16px 20px',
                              backgroundColor: '#0369a1',
                              borderRadius: '10px',
                              boxShadow: '0 2px 8px rgba(3, 105, 161, 0.2)',
                              letterSpacing: '-0.01em'
                            }}>
                              Other Factors
                            </h3>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                              gap: '20px'
                            }}>
                              {BLOCK_COMPLEXITY_FACTOR_SCHEMA.filter(schema =>
                                schema.id !== 'low_power_non_nested' &&
                                schema.id !== 'low_power_nested' &&
                                schema.id !== 'new_design' &&
                                schema.id !== 'synthesis_complexity' &&
                                schema.id !== 'macro_intensive' &&
                                schema.id !== 'io_blocks' &&
                                schema.id !== 'physical_blocks' &&
                                schema.id !== 'merged_mode_constraints' &&
                                schema.id !== 'dft_block_level' &&
                                schema.id !== 'constraints_development'
                              ).map((schema) => renderFactorCard(schema))}
                            </div>
                          </div>
                        )}
                    </>
                  );
                })()}

                {/* DFT Context Percentages Configuration */}
                <div style={{
                  marginTop: '40px',
                  padding: '24px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{
                    margin: '0 0 16px 0',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}>
                    DFT Context Percentages
                  </h3>
                  <p className="help-text" style={{ marginBottom: '20px', fontSize: '13px', color: '#64748b' }}>
                    Configure DFT percentage based on context (IO/Analog presence). These percentages are applied to the DFT component only. IO and Analog have their own separate adders (20% and 30% respectively).
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <div className="form-group">
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#64748b'
                      }}>
                        DFT Alone (%)
                        <span style={{ marginLeft: '4px', color: '#64748b', fontSize: '11px' }}>
                          (No IO, No Analog)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={localConfig.dftContextPercentages?.dftAlone ?? 60}
                        onChange={(e) => {
                          const newValue = Math.max(0, parseFloat(e.target.value) || 0);
                          setLocalConfig({
                            ...localConfig,
                            dftContextPercentages: {
                              dftAlone: newValue,
                              dftWithIoOrAnalog: localConfig.dftContextPercentages?.dftWithIoOrAnalog ?? 70,
                              dftWithIoAndAnalog: localConfig.dftContextPercentages?.dftWithIoAndAnalog ?? 80,
                            }
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: '15px',
                          border: '2px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#64748b'
                      }}>
                        DFT with IO OR Analog (%)
                        <span style={{ marginLeft: '4px', color: '#64748b', fontSize: '11px' }}>
                          (Either IO or Analog, not both)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={localConfig.dftContextPercentages?.dftWithIoOrAnalog ?? 70}
                        onChange={(e) => {
                          const newValue = Math.max(0, parseFloat(e.target.value) || 0);
                          setLocalConfig({
                            ...localConfig,
                            dftContextPercentages: {
                              dftAlone: localConfig.dftContextPercentages?.dftAlone ?? 60,
                              dftWithIoOrAnalog: newValue,
                              dftWithIoAndAnalog: localConfig.dftContextPercentages?.dftWithIoAndAnalog ?? 80,
                            }
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: '15px',
                          border: '2px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#64748b'
                      }}>
                        DFT with IO AND Analog (%)
                        <span style={{ marginLeft: '4px', color: '#64748b', fontSize: '11px' }}>
                          (Both IO and Analog present)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={localConfig.dftContextPercentages?.dftWithIoAndAnalog ?? 80}
                        onChange={(e) => {
                          const newValue = Math.max(0, parseFloat(e.target.value) || 0);
                          setLocalConfig({
                            ...localConfig,
                            dftContextPercentages: {
                              dftAlone: localConfig.dftContextPercentages?.dftAlone ?? 60,
                              dftWithIoOrAnalog: localConfig.dftContextPercentages?.dftWithIoOrAnalog ?? 70,
                              dftWithIoAndAnalog: newValue,
                            }
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: '15px',
                          border: '2px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="section-save-button" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={() => setEditDefaults({ ...editDefaults, 'block-complexity': !editDefaults['block-complexity'] })}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      border: `2px solid ${editDefaults['block-complexity'] ? '#0369a1' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      backgroundColor: editDefaults['block-complexity'] ? '#0369a1' : 'white',
                      color: editDefaults['block-complexity'] ? 'white' : '#1a202c',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                  >
                    {editDefaults['block-complexity'] ? '✓ Edit Defaults Enabled' : 'Edit Defaults'}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => handleSaveSection('block-complexity')}
                    disabled={savingSection === 'block-complexity' || loading}
                  >
                    {savingSection === 'block-complexity' ? 'Saving...' : 'Save Block Complexity'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'fullchip' && (
              <div className="config-section">
                <h2>Full Chip only</h2>

                {editDefaults.fullchip && (
                  <div style={{
                    padding: '12px 16px',
                    marginBottom: '24px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <div>
                      <strong style={{ color: '#92400e' }}>Editing Global Default Rules</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#78350f' }}>
                        You are editing default estimation rules. Changes will immediately affect all customer cost calculations.
                      </p>
                    </div>
                  </div>
                )}

                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#ffffff',
                  marginBottom: '20px',
                  padding: '16px 20px',
                  backgroundColor: '#0369a1',
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(3, 105, 161, 0.2)',
                  letterSpacing: '-0.01em'
                }}>
                  Fixed Resources
                </h3>
                {localConfig.fullChip.fixed.map((factor, index) => (
                  <div
                    key={factor.id}
                    className="config-item"
                    style={{
                      padding: '24px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      backgroundColor: '#ffffff',
                      marginBottom: '16px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '20px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0369a1';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(3, 105, 161, 0.15)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#64748b'
                      }}>
                        Name
                      </label>
                      <input
                        type="text"
                        value={factor.name}
                        onChange={(e) => {
                          const newFixed = [...localConfig.fullChip.fixed];
                          newFixed[index] = { ...newFixed[index], name: e.target.value };
                          setLocalConfig({ ...localConfig, fullChip: { ...localConfig.fullChip, fixed: newFixed } });
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: '15px',
                          border: '2px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          color: '#1e293b',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#0369a1';
                          e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#cbd5e1';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#64748b'
                      }}>
                        Resources
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={factor.resources ?? 0}
                        onChange={(e) => {
                          const newFixed = [...localConfig.fullChip.fixed];
                          newFixed[index] = { ...newFixed[index], resources: parseFloat(e.target.value) || 0 };
                          setLocalConfig({ ...localConfig, fullChip: { ...localConfig.fullChip, fixed: newFixed } });
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: '15px',
                          border: '2px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          color: '#1e293b',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#0369a1';
                          e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#cbd5e1';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                ))}

                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#ffffff',
                  marginBottom: '20px',
                  marginTop: '32px',
                  padding: '16px 20px',
                  backgroundColor: '#0369a1',
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(3, 105, 161, 0.2)',
                  letterSpacing: '-0.01em'
                }}>
                  Percentage-Based Factors
                </h3>
                {localConfig.fullChip.percentage.map((factor, index) => {
                  // For clock_distribution (mesh/MS-CTS), remove levels and ensure default is 30%
                  const isClockDistribution = factor.id === 'clock_distribution';
                  const displayFactor = isClockDistribution
                    ? { ...factor, levels: undefined, resourcePercentage: (factor.resourcePercentage && factor.resourcePercentage > 0) ? factor.resourcePercentage : 30 }
                    : factor;
                  
                  // Get the actual resourcePercentage value (default to 30 for clock_distribution if 0, null, or undefined)
                  const currentValue = isClockDistribution 
                    ? ((factor.resourcePercentage && factor.resourcePercentage > 0) ? factor.resourcePercentage : 30)
                    : (factor.resourcePercentage ?? 0);

                  return (
                    <div
                      key={factor.id}
                      className="config-item"
                      style={{
                        padding: '24px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0369a1';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(3, 105, 161, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '20px',
                        letterSpacing: '-0.01em'
                      }}>
                        {displayFactor.name}
                      </h3>

                      {!displayFactor.levels || displayFactor.levels.length === 0 ? (
                        // Simple percentage factor (no levels)
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#64748b'
                          }}>
                            Multiplier Percentage (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={currentValue}
                            onChange={(e) => {
                              const newPercentage = [...localConfig.fullChip.percentage];
                              const newValue = parseFloat(e.target.value) || (isClockDistribution ? 30 : 0);
                              newPercentage[index] = { 
                                ...newPercentage[index], 
                                resourcePercentage: newValue,
                                levels: isClockDistribution ? undefined : newPercentage[index].levels 
                              };
                              setLocalConfig({ ...localConfig, fullChip: { ...localConfig.fullChip, percentage: newPercentage } });
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              fontSize: '15px',
                              border: '2px solid #cbd5e1',
                              borderRadius: '8px',
                              backgroundColor: '#ffffff',
                              color: '#1e293b',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#0369a1';
                              e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#cbd5e1';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        // Factor with levels
                        <>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#64748b'
                            }}>
                              Default Percentage (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={displayFactor.resourcePercentage ?? 0}
                              onChange={(e) => {
                                const newPercentage = [...localConfig.fullChip.percentage];
                                newPercentage[index] = { ...newPercentage[index], resourcePercentage: Math.max(0, parseFloat(e.target.value) || 0) };
                                setLocalConfig({ ...localConfig, fullChip: { ...localConfig.fullChip, percentage: newPercentage } });
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 14px',
                                fontSize: '15px',
                                border: '2px solid #cbd5e1',
                                borderRadius: '8px',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#0369a1';
                                e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#cbd5e1';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                          </div>

                          <div className="levels-section" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #e2e8f0' }}>
                            <h4 style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              marginBottom: '16px',
                              color: '#1e293b'
                            }}>
                              Level Options
                            </h4>
                            {displayFactor.levels.map((level, levelIndex) => (
                              <div
                                key={level.id}
                                className="level-item"
                                style={{
                                  padding: '16px',
                                  background: '#f7fafc',
                                  borderRadius: '10px',
                                  marginBottom: '12px',
                                  opacity: level.locked ? 0.7 : 1,
                                  border: '2px solid #e2e8f0',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!level.locked || editDefaults.fullchip) {
                                    e.currentTarget.style.borderColor = '#0369a1';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(3, 105, 161, 0.1)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#e2e8f0';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label>
                                      Level Label
                                      {level.locked && !editDefaults.fullchip && <span style={{ color: '#718096', fontSize: '11px' }}>(Locked)</span>}
                                      {level.locked && editDefaults.fullchip && <span style={{ color: '#0369a1', fontSize: '11px', fontWeight: '600' }}>(Editing Default)</span>}
                                    </label>
                                    <input
                                      type="text"
                                      value={level.label ?? ''}
                                      onChange={(e) => {
                                        const newPercentage = [...localConfig.fullChip.percentage];
                                        const newLevels = [...(newPercentage[index].levels || [])];
                                        newLevels[levelIndex] = { ...newLevels[levelIndex], label: e.target.value };
                                        newPercentage[index] = { ...newPercentage[index], levels: newLevels };
                                        setLocalConfig({ ...localConfig, fullChip: { ...localConfig.fullChip, percentage: newPercentage } });
                                      }}
                                      disabled={level.locked && !editDefaults.fullchip}
                                      style={{
                                        width: '100%',
                                        padding: '12px 14px',
                                        fontSize: '15px',
                                        border: '2px solid #cbd5e1',
                                        borderRadius: '8px',
                                        color: '#1e293b',
                                        transition: 'all 0.2s ease',
                                        outline: 'none',
                                        borderColor: (level.locked && editDefaults.fullchip) ? '#0369a1' : '#cbd5e1',
                                        backgroundColor: (level.locked && editDefaults.fullchip) ? '#f0f9ff' : ((level.locked && !editDefaults.fullchip) ? '#f1f5f9' : '#ffffff')
                                      }}
                                      onFocus={(e) => {
                                        if (!(level.locked && !editDefaults.fullchip)) {
                                          e.target.style.borderColor = '#0369a1';
                                          e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                                        }
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = (level.locked && editDefaults.fullchip) ? '#0369a1' : '#cbd5e1';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    />
                                  </div>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label>
                                      Percentage (%)
                                      {level.locked && !editDefaults.fullchip && <span style={{ color: '#718096', fontSize: '11px' }}>(Locked)</span>}
                                      {level.locked && editDefaults.fullchip && <span style={{ color: '#0369a1', fontSize: '11px', fontWeight: '600' }}>(Editing Default)</span>}
                                    </label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={level.resourcePercentage ?? 0}
                                      onChange={(e) => {
                                        const newPercentage = [...localConfig.fullChip.percentage];
                                        const newLevels = [...(newPercentage[index].levels || [])];
                                        newLevels[levelIndex] = { ...newLevels[levelIndex], resourcePercentage: Math.max(0, parseFloat(e.target.value) || 0) };
                                        newPercentage[index] = { ...newPercentage[index], levels: newLevels };
                                        setLocalConfig({ ...localConfig, fullChip: { ...localConfig.fullChip, percentage: newPercentage } });
                                      }}
                                      disabled={level.locked && !editDefaults.fullchip}
                                      style={{
                                        width: '100%',
                                        padding: '12px 14px',
                                        fontSize: '15px',
                                        border: '2px solid #cbd5e1',
                                        borderRadius: '8px',
                                        color: '#1e293b',
                                        transition: 'all 0.2s ease',
                                        outline: 'none',
                                        borderColor: (level.locked && editDefaults.fullchip) ? '#0369a1' : '#cbd5e1',
                                        backgroundColor: (level.locked && editDefaults.fullchip) ? '#f0f9ff' : ((level.locked && !editDefaults.fullchip) ? '#f1f5f9' : '#ffffff')
                                      }}
                                      onFocus={(e) => {
                                        if (!(level.locked && !editDefaults.fullchip)) {
                                          e.target.style.borderColor = '#0369a1';
                                          e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                                        }
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = (level.locked && editDefaults.fullchip) ? '#0369a1' : '#cbd5e1';
                                        e.target.style.boxShadow = 'none';
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="section-save-button" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={() => setEditDefaults({ ...editDefaults, fullchip: !editDefaults.fullchip })}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      border: `2px solid ${editDefaults.fullchip ? '#0369a1' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      backgroundColor: editDefaults.fullchip ? '#0369a1' : 'white',
                      color: editDefaults.fullchip ? 'white' : '#1a202c',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                  >
                    {editDefaults.fullchip ? '✓ Edit Defaults Enabled' : 'Edit Defaults'}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => handleSaveSection('fullchip')}
                    disabled={savingSection === 'fullchip' || loading}
                  >
                    {savingSection === 'fullchip' ? 'Saving...' : 'Save Full Chip'}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Dialog */}
            {showSaveConfirmation && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '24px',
                  maxWidth: '500px',
                  width: '90%',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#1a202c' }}>
                    Confirm Save Changes
                  </h3>
                  <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                    These changes will immediately affect all customer cost calculations.
                  </p>
                  <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
                    Are you sure you want to proceed?
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setShowSaveConfirmation(false);
                        setPendingSaveSection(null);
                      }}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setShowSaveConfirmation(false);
                        if (pendingSaveSection) {
                          await handleSaveSection(pendingSaveSection, true);
                          setPendingSaveSection(null);
                        }
                      }}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#0369a1',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Confirm & Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cost' && (
              <div className="config-section">
                <h2>Cost Settings</h2>
                <div className="form-group">
                  <label>Cost Per Resource Per Month (₹)</label>
                  <input
                    type="number"
                    value={localConfig.costPerResourcePerMonth}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      costPerResourcePerMonth: parseInt(e.target.value) || 0
                    })}
                  />
                  <p className="help-text">Current value: ₹{localConfig.costPerResourcePerMonth.toLocaleString()} (4L per month)</p>
                </div>
                <div className="section-save-button" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={() => setEditDefaults({ ...editDefaults, cost: !editDefaults.cost })}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      border: `2px solid ${editDefaults.cost ? '#0369a1' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      backgroundColor: editDefaults.cost ? '#0369a1' : 'white',
                      color: editDefaults.cost ? 'white' : '#1a202c',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '600'
                    }}
                  >
                    {editDefaults.cost ? '✓ Edit Defaults Enabled' : 'Edit Defaults'}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => handleSaveSection('cost')}
                    disabled={savingSection === 'cost' || loading}
                  >
                    {savingSection === 'cost' ? 'Saving...' : 'Save Cost Settings'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="config-section">
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2>Customer Projects</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Search projects..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            padding: '8px 12px 8px 36px',
                            fontSize: '14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            width: '250px',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#0369a1'}
                          onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                        />
                        <span style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#64748b',
                          fontSize: '16px'
                        }}>🔍</span>
                      </div>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          outline: 'none',
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          minWidth: '180px'
                        }}
                      >
                        <option value="date-desc">Date: Newest First</option>
                        <option value="date-asc">Date: Oldest First</option>
                        <option value="price-desc">Price: High to Low</option>
                        <option value="price-asc">Price: Low to High</option>
                        <option value="name-asc">Project Name: A-Z</option>
                        <option value="name-desc">Project Name: Z-A</option>
                        <option value="customer-asc">Customer: A-Z</option>
                        <option value="customer-desc">Customer: Z-A</option>
                        <option value="duration-desc">Duration: Longest</option>
                        <option value="duration-asc">Duration: Shortest</option>
                      </select>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                          padding: '8px 16px',
                          fontSize: '14px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          backgroundColor: showFilters ? '#0369a1' : 'white',
                          color: showFilters ? 'white' : '#1a202c',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={loadProjects}
                        disabled={loadingProjects}
                        style={{ fontSize: '14px', padding: '8px 16px' }}
                      >
                        {loadingProjects ? 'Loading...' : 'Refresh'}
                      </button>
                    </div>
                  </div>

                  {/* Filter Panel */}
                  {showFilters && (
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                            Customer
                          </label>
                          <input
                            type="text"
                            placeholder="Filter by customer..."
                            value={filterCustomer}
                            onChange={(e) => setFilterCustomer(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                            Min Cost (₹)
                          </label>
                          <input
                            type="number"
                            placeholder="Min cost..."
                            value={filterCostMin}
                            onChange={(e) => setFilterCostMin(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                            Max Cost (₹)
                          </label>
                          <input
                            type="number"
                            placeholder="Max cost..."
                            value={filterCostMax}
                            onChange={(e) => setFilterCostMax(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                            Min Duration (months)
                          </label>
                          <input
                            type="number"
                            placeholder="Min duration..."
                            value={filterDurationMin}
                            onChange={(e) => setFilterDurationMin(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                            Max Duration (months)
                          </label>
                          <input
                            type="number"
                            placeholder="Max duration..."
                            value={filterDurationMax}
                            onChange={(e) => setFilterDurationMax(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button
                            onClick={() => {
                              setFilterCustomer('');
                              setFilterCostMin('');
                              setFilterCostMax('');
                              setFilterDurationMin('');
                              setFilterDurationMax('');
                            }}
                            style={{
                              padding: '8px 16px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: 'white',
                              color: '#64748b',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Clear Filters
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {loadingProjects ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading projects...</p>
                  </div>
                ) : (() => {
                  // Apply filters first
                  let filteredProjects = projects.filter((project) => {
                    // Search query filter
                    if (searchQuery.trim()) {
                      const query = searchQuery.toLowerCase();
                      const matchesSearch = (
                        (project.projectName || '').toLowerCase().includes(query) ||
                        (project.customerName || project.user?.name || '').toLowerCase().includes(query) ||
                        (project.customerEmail || project.user?.email || '').toLowerCase().includes(query) ||
                        (project.technologyNode || '').toLowerCase().includes(query) ||
                        formatCurrency(project.estimatedCost).toLowerCase().includes(query)
                      );
                      if (!matchesSearch) return false;
                    }

                    // Customer filter
                    if (filterCustomer.trim()) {
                      const customerName = (project.customerName || project.user?.name || '').toLowerCase();
                      const customerEmail = (project.customerEmail || project.user?.email || '').toLowerCase();
                      const filterLower = filterCustomer.toLowerCase();
                      if (!customerName.includes(filterLower) && !customerEmail.includes(filterLower)) return false;
                    }

                    // Cost range filter
                    const projectCost = project.estimatedCost || 0;
                    if (filterCostMin && projectCost < parseFloat(filterCostMin)) return false;
                    if (filterCostMax && projectCost > parseFloat(filterCostMax)) return false;

                    // Duration range filter
                    const projectDuration = project.estimatedDurationMonths || 0;
                    if (filterDurationMin && projectDuration < parseFloat(filterDurationMin)) return false;
                    if (filterDurationMax && projectDuration > parseFloat(filterDurationMax)) return false;

                    return true;
                  });

                  // Sort projects based on selected sort option
                  const sortedProjects = [...filteredProjects].sort((a, b) => {
                    switch (sortBy) {
                      case 'date-desc':
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                      case 'date-asc':
                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                      case 'price-desc':
                        return (b.estimatedCost || 0) - (a.estimatedCost || 0);
                      case 'price-asc':
                        return (a.estimatedCost || 0) - (b.estimatedCost || 0);
                      case 'name-asc':
                        return (a.projectName || '').localeCompare(b.projectName || '');
                      case 'name-desc':
                        return (b.projectName || '').localeCompare(a.projectName || '');
                      case 'customer-asc':
                        return ((a.customerName || a.user?.name) || '').localeCompare((b.customerName || b.user?.name) || '');
                      case 'customer-desc':
                        return ((b.customerName || b.user?.name) || '').localeCompare((a.customerName || a.user?.name) || '');
                      case 'duration-desc':
                        return (b.estimatedDurationMonths || 0) - (a.estimatedDurationMonths || 0);
                      case 'duration-asc':
                        return (a.estimatedDurationMonths || 0) - (b.estimatedDurationMonths || 0);
                      default:
                        return 0;
                    }
                  });

                  filteredProjects = sortedProjects;

                  // Calculate pagination
                  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
                  const startIndex = (currentPage - 1) * projectsPerPage;
                  const endIndex = startIndex + projectsPerPage;
                  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

                  if (filteredProjects.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <p>{searchQuery ? `No projects found matching "${searchQuery}"` : 'No projects found.'}</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}>
                          <thead>
                            <tr style={{ backgroundColor: '#0369a1', borderBottom: '2px solid #075985' }}>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>ID</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>Project Name</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>Customer</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>Email</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>Cost</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>Duration</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>Created</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '14px', color: '#ffffff' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedProjects.map((project, index) => (
                              <tr key={project.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4a5568' }}>{startIndex + index + 1}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1a202c', fontWeight: '500' }}>
                                  <span
                                    onClick={() => handleViewProject(project.id)}
                                    style={{
                                      color: '#0369a1',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      fontWeight: '500'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = '#075985';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = '#0369a1';
                                    }}
                                  >
                                    {project.projectName || 'N/A'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4a5568' }}>
                                  {project.customerName || project.user?.name || 'N/A'}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4a5568' }}>
                                  {project.customerEmail || project.user?.email || 'N/A'}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1a202c', fontWeight: '600' }}>
                                  {formatCurrency(project.estimatedCost)}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4a5568' }}>
                                  {project.estimatedDurationMonths ? `${project.estimatedDurationMonths} months` : 'N/A'}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>
                                  {formatDate(project.createdAt)}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => handleDeleteProject(project.id)}
                                    disabled={deletingProjectId === project.id}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#ef4444',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      cursor: deletingProjectId === project.id ? 'not-allowed' : 'pointer',
                                      opacity: deletingProjectId === project.id ? 0.6 : 1
                                    }}
                                  >
                                    {deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '24px',
                          padding: '16px'
                        }}>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '8px 16px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: currentPage === 1 ? '#f1f5f9' : 'white',
                              color: currentPage === 1 ? '#94a3b8' : '#1a202c',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Previous
                          </button>

                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                              // Show first page, last page, current page, and pages around current
                              if (
                                pageNum === 1 ||
                                pageNum === totalPages ||
                                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                              ) {
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: '14px',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '6px',
                                      backgroundColor: currentPage === pageNum ? '#0369a1' : 'white',
                                      color: currentPage === pageNum ? 'white' : '#1a202c',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      minWidth: '40px'
                                    }}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              } else if (
                                pageNum === currentPage - 2 ||
                                pageNum === currentPage + 2
                              ) {
                                return <span key={pageNum} style={{ padding: '0 4px', color: '#64748b' }}>...</span>;
                              }
                              return null;
                            })}
                          </div>

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                              padding: '8px 16px',
                              fontSize: '14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: currentPage === totalPages ? '#f1f5f9' : 'white',
                              color: currentPage === totalPages ? '#94a3b8' : '#1a202c',
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Next
                          </button>

                          <div style={{ marginLeft: '16px', fontSize: '14px', color: '#64748b' }}>
                            Showing {startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length} projects
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Project Details Modal */}
      {showProjectModal && selectedProject && (
        <MyProjectsModal
          onClose={() => setShowProjectModal(false)}
          initialProject={selectedProject}
        />
      )}




    </div>
  );
};
