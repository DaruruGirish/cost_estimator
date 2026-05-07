import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../services/api';
import { useConfig } from '../context/ConfigContext';
import './MyProjectsModal.css';

interface ProjectBlock {
  id: number;
  blockName: string;
  gateCountMillion: number;
  rtlDrops: number;
  lowPowerType: 'none' | 'non_nested' | 'nested';
  selectedFactors?: Array<{
    factorKey: string;
    appliedValue: any;
    factorSnapshot: any;
  }>;
}

interface Project {
  id: number;
  projectName: string;
  customerName?: string;
  customerEmail?: string;
  technologyNode?: string;
  estimatedCost: number;
  estimatedDurationMonths: number;
  createdAt: string;
  isFullChip?: boolean;
  isFlat?: boolean; // New flag for Flat implementation
  numberOfBlocks?: number;
  blocks?: ProjectBlock[];
  selectedFactors?: Array<{
    factorKey: string;
    appliedValue: any;
    factorSnapshot: any;
  }>;
  user?: {
    name: string;
    email: string;
  };
}

interface MyProjectsModalProps {
  onClose: () => void;
  initialProject?: Project | null;
}

export const MyProjectsModal = ({ onClose, initialProject }: MyProjectsModalProps) => {
  const { configuration } = useConfig();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(initialProject || null);

  useEffect(() => {
    if (!initialProject) {
      loadProjects();
    } else {
      setLoading(false);
    }
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated (has auth token)
      const authToken = localStorage.getItem('auth_token');
      const userEmail = localStorage.getItem('rtlgds_user_email') || localStorage.getItem('rtlgds_lead_email');

      if (authToken) {
        // Authenticated user - backend will use userId from JWT token
        try {
          const data = await apiService.getMyProjects();
          setProjects(Array.isArray(data) ? data : []);
        } catch (err: any) {
          console.error('Failed to load projects for authenticated user:', err);
          // If that fails and we have email, try with email as fallback
          if (userEmail) {
            try {
              const data = await apiService.getMyProjects(userEmail);
              setProjects(Array.isArray(data) ? data : []);
            } catch (emailErr: any) {
              setError(emailErr?.message || 'Failed to load projects. Please try again.');
            }
          } else {
            setError(err?.message || 'Failed to load projects. Please try again.');
          }
        }
      } else if (userEmail) {
        // Public user - use email to get projects
        try {
          const data = await apiService.getMyProjects(userEmail);
          setProjects(Array.isArray(data) ? data : []);
        } catch (err: any) {
          console.error('Failed to load projects by email:', err);
          setError(err?.message || 'Failed to load projects. Please try again.');
        }
      } else {
        // No authentication and no email
        setError('No email found. Please provide your email on the entry page or log in.');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.error('Unexpected error loading projects:', err);
      setError(err?.message || 'Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (!amount || amount === 0) return '₹0';
    // Show full number with Indian number formatting (commas)
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(d.getTime() + istOffset);
    const year = istTime.getUTCFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[istTime.getUTCMonth()];
    const day = istTime.getUTCDate();
    return `${day} ${month} ${year}`;
  };

  const getFactorName = (factorKey: string, isFullChip: boolean = false): string => {
    if (isFullChip) {
      const fixedFactor = configuration?.fullChip?.fixed?.find(f => f.id === factorKey);
      if (fixedFactor) return fixedFactor.name;

      const percentageFactor = configuration?.fullChip?.percentage?.find(f => f.id === factorKey);
      if (percentageFactor) return percentageFactor.name;

      // Special cases
      if (factorKey === 'dft_enabled') return 'DFT';
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

  const handleViewProject = async (projectId: number) => {
    try {
      const projectDetails = await apiService.getProjectById(projectId);
      setSelectedProject(projectDetails);
    } catch (err: any) {
      setError(err?.message || 'Failed to load project details.');
    }
  };

  return createPortal(
    <div className="my-projects-modal-overlay" onClick={onClose}>
      <div className="my-projects-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="my-projects-modal-header">
          <h2>My Projects</h2>
          <button className="my-projects-close-btn" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="my-projects-loading">
            <p>Loading projects...</p>
          </div>
        ) : error ? (
          <div className="my-projects-error">
            <p>{error}</p>
            <button onClick={loadProjects} className="my-projects-retry-btn">Retry</button>
          </div>
        ) : selectedProject ? (
          <div className="my-projects-details">
            <button
              className="my-projects-back-btn"
              onClick={() => setSelectedProject(null)}
            >
              ← Back to List
            </button>

            {/* Project Information */}
            <div className="my-projects-detail-section">
              <h3>Project Information</h3>
              <div className="my-projects-detail-grid">
                <div>
                  <strong>Project Name:</strong>
                  <p>{selectedProject.projectName || 'N/A'}</p>
                </div>
                <div>
                  <strong>Technology Node:</strong>
                  <p>{selectedProject.technologyNode || 'N/A'}</p>
                </div>
                <div>
                  <strong>Engagement Scope:</strong>
                  <p>
                    {selectedProject.isFlat
                      ? 'Flat implementation'
                      : selectedProject.isFullChip
                        ? 'Block + Full-Chip'
                        : 'Block Development only'}
                  </p>
                </div>
                <div>
                  <strong>Number of Blocks:</strong>
                  <p>{selectedProject.numberOfBlocks || selectedProject.blocks?.length || 0}</p>
                </div>
                <div>
                  <strong>Estimated Cost:</strong>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: '#1FA2A8' }}>
                    {formatCurrency(selectedProject.estimatedCost)}
                  </p>
                </div>
                <div>
                  <strong>Duration:</strong>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: '#1FA2A8' }}>
                    {selectedProject.estimatedDurationMonths ? `${selectedProject.estimatedDurationMonths} months` : 'N/A'}
                  </p>
                </div>
                <div>
                  <strong>Created:</strong>
                  <p>{formatDate(selectedProject.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Full Chip only */}
            {selectedProject.isFullChip && selectedProject.selectedFactors && selectedProject.selectedFactors.length > 0 && (
              <div className="my-projects-detail-section">
                <h3>Full Chip only</h3>
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {/* RTL Drops - inline format */}
                  {selectedProject.blocks && selectedProject.blocks.length > 0 && selectedProject.blocks[0].rtlDrops && (
                    <div style={{ marginBottom: '16px' }}>
                      <strong style={{ color: '#64748b' }}>RTL Drops: </strong>
                      <span style={{ fontSize: '14px', color: '#1a202c', fontWeight: '500' }}>{selectedProject.blocks[0].rtlDrops}</span>
                    </div>
                  )}

                  {/* Execution Scope - All factors combined including DFT */}
                  {selectedProject.selectedFactors.filter(f =>
                    ['pnr', 'ir_drop', 'pv', 'sta', 'low_power_full_chip', 'abutment_floorplan', 'analog_ip_integration', 'clock_distribution', 'modes', 'dft_enabled'].includes(f.factorKey)
                  ).length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <strong style={{ display: 'block', marginBottom: '8px', color: '#64748b' }}>Execution Scope:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {selectedProject.selectedFactors
                            .filter(f => ['pnr', 'ir_drop', 'pv', 'sta', 'low_power_full_chip', 'abutment_floorplan', 'analog_ip_integration', 'clock_distribution', 'modes', 'dft_enabled'].includes(f.factorKey))
                            .map((factor, idx) => (
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
                                {getFactorName(factor.factorKey, true)}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* IO complexity (from percentageFactorLevels) */}
                  {selectedProject.selectedFactors.filter(f =>
                    f.factorKey === 'io_pad_count' && f.factorSnapshot?.levelId
                  ).length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <strong style={{ display: 'block', marginBottom: '8px', color: '#64748b' }}>IO complexity:</strong>
                        {selectedProject.selectedFactors
                          .filter(f => f.factorKey === 'io_pad_count' && f.factorSnapshot?.levelId)
                          .map((factor, idx) => (
                            <p key={idx} style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>
                              {getFactorLevelLabel(factor.factorKey, factor.factorSnapshot.levelId, true)}
                            </p>
                          ))}
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Blocks Configuration */}
            {selectedProject.blocks && selectedProject.blocks.length > 0 && (
              <div className="my-projects-detail-section">
                <h3>Block Configurations</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedProject.blocks.map((block, index) => {
                    const blockFactors = block.selectedFactors || [];
                    const complexityFactors = blockFactors.filter(f =>
                      !['low_power_non_nested', 'low_power_nested'].includes(f.factorKey) && !f.factorSnapshot
                    );
                    const hasLowPower = block.lowPowerType && block.lowPowerType !== 'none';
                    const lowPowerType = block.lowPowerType || 'none';
                    const hasNewDesign = blockFactors.some(f => f.factorKey === 'new_design');
                    const hasRevision = blockFactors.some(f => f.factorKey === 'revision');
                    const hasFlat = blockFactors.some(f => f.factorKey === 'flat');
                    const hasHierarchical = blockFactors.some(f => f.factorKey === 'hierarchical');
                    const hasDFT = blockFactors.some(f => f.factorKey === 'dft_block_level');

                    return (
                      <div
                        key={block.id || index}
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
                              {block.gateCountMillion ? `${block.gateCountMillion}M` : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>RTL Drops:</strong>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>{block.rtlDrops || 'N/A'}</p>
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
                              {hasFlat ? 'Flat' : hasHierarchical ? 'Hierarchical' : 'N/A'}
                            </p>
                          </div>
                          {hasDFT && (
                            <div>
                              <strong style={{ display: 'block', marginBottom: '4px', color: '#64748b', fontSize: '13px' }}>DFT Ownership:</strong>
                              <p style={{ margin: 0, fontSize: '14px', color: '#1a202c' }}>Enabled</p>
                            </div>
                          )}
                        </div>

                        {/* Design Scope */}
                        {complexityFactors.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <strong style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '13px' }}>Design Scope:</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {complexityFactors.map((factor, idx) => (
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
                                  {getFactorName(factor.factorKey, false)}
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
        ) : projects.length === 0 ? (
          <div className="my-projects-empty">
            <p>No projects found. Start by clicking "Calculate" to save your first project.</p>
          </div>
        ) : (
          <div className="my-projects-list">
            <table className="my-projects-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Cost</th>
                  <th>Duration</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>{project.projectName || 'N/A'}</td>
                    <td>{formatCurrency(project.estimatedCost)}</td>
                    <td>{project.estimatedDurationMonths ? `${project.estimatedDurationMonths} months` : 'N/A'}</td>
                    <td>{formatDate(project.createdAt)}</td>
                    <td>
                      <button
                        className="my-projects-view-btn"
                        onClick={() => handleViewProject(project.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

