import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Configuration } from '../types';
import { defaultConfiguration } from '../data/defaultConfig';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';

interface ConfigContextType {
  configuration: Configuration;
  updateConfiguration: (config: Configuration) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const { userRole } = useAuth();
  const [configuration, setConfiguration] = useState<Configuration>(defaultConfiguration);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, [userRole]);

  const normalizeConfiguration = (config: Configuration): Configuration => {
    // Ensure blockGateCount has all required fields with defaults
    // Use defensive checks to ensure values are valid numbers
    const existingBlockGateCount = config.blockGateCount || {};
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
        : 4.5,
    };

    // Verify blockGateCount is complete
    if (!blockGateCount.baseGateCount || blockGateCount.baseGateCount <= 0) {
      console.error('Invalid blockGateCount in normalization:', blockGateCount, 'from config:', config.blockGateCount);
      // Force valid defaults
      blockGateCount.baseGateCount = 1.5;
      blockGateCount.baseResource = 0.5;
      blockGateCount.gateIncrementStep = 1.0;
      blockGateCount.additionalResourcePercentage = 10;
      blockGateCount.maxGateCount = 4.5;
    }

    // Construct explicitly to avoid spreading incomplete objects
    const normalized: Configuration = {
      blockTimeline: config.blockTimeline || [],
      fullChipTimeline: config.fullChipTimeline || [],
      blockGateCount, // Use normalized blockGateCount
      blockComplexity: (config.blockComplexity || []).map(factor => ({
        ...factor,
        enabled: factor.enabled !== undefined ? factor.enabled : true,
      })),
      fullChip: {
        fixed: (config.fullChip?.fixed || []).map(factor => ({
          ...factor,
        })),
        percentage: (config.fullChip?.percentage || []).map(factor => ({
          ...factor,
          enabled: factor.enabled !== undefined ? factor.enabled : true,
          levels: factor.levels?.map(level => ({
            ...level,
            locked: level.locked !== undefined ? level.locked : false,
          })),
        })),
      },
      dft: config.dft || {
        cadFlow: { id: 'dft-cad', name: 'DFT CAD/Flow', resources: 1.0 },
      },
      costPerResourcePerMonth: config.costPerResourcePerMonth || 400000,
      technologyNodeMultipliers: config.technologyNodeMultipliers || {},
      additionalFactors: config.additionalFactors || [],
    };

    // Log for debugging
    console.log('Normalized configuration - blockGateCount:', normalized.blockGateCount);
    
    return normalized;
  };

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load configuration from public endpoint (works for all users)
      // This allows customers to see the actual configured values (timelines, factors, etc.)
      // instead of just defaults
        try {
      const config = await apiService.getConfiguration();
      const normalizedConfig = normalizeConfiguration(config);
      setConfiguration(normalizedConfig);
        } catch (err: any) {
        // If config fails, fallback to default
        console.warn('Failed to load configuration, using defaults:', err);
        setConfiguration(defaultConfiguration);
      }
    } catch (err: any) {
      console.error('Failed to load configuration:', err);
      const errorMessage = err?.message || 'Failed to load configuration';
      setError(errorMessage);
      // Fallback to default if API fails
      setConfiguration(defaultConfiguration);
    } finally {
      setLoading(false);
    }
  };

  const updateConfiguration = async (config: Configuration) => {
    try {
      setError(null);
      console.log('updateConfiguration called with config:', config);
      console.log('config.blockGateCount:', config.blockGateCount);
      const normalizedConfig = normalizeConfiguration(config);
      console.log('normalizedConfig.blockGateCount:', normalizedConfig.blockGateCount);
      console.log('Sending to API:', JSON.stringify(normalizedConfig.blockGateCount));
      const updated = await apiService.updateConfiguration(normalizedConfig);
      const normalizedUpdated = normalizeConfiguration(updated);
      setConfiguration(normalizedUpdated);
    } catch (err: any) {
      console.error('Failed to update configuration:', err);
      console.error('Config that failed:', config);
      console.error('Normalized config that failed:', normalizeConfiguration(config));
      const errorMessage = err?.message || 'Failed to update configuration';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return (
    <ConfigContext.Provider value={{ configuration, updateConfiguration, loading, error }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};

