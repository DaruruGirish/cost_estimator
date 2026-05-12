import React, { useState, useRef, useEffect } from 'react';
import './CustomDropdown.css';

interface CustomDropdownProps {
    value: number | string;
    onChange: (value: any) => void;
    options: { value: number | string; label: string }[];
    className?: string;
    style?: React.CSSProperties;
    searchable?: boolean;
    placeholder?: string;
    maxHeight?: string; // New prop to control list height
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ value, onChange, options, className = '', style = {}, searchable = false, placeholder = 'Select...', maxHeight }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search on close
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter options based on search term
    const filteredOptions = searchable
        ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
        : options;

    const selectedOption = options.find(opt => opt.value === value);

    const handleHeaderClick = () => {
        if (!isOpen && searchable) {
            setSearchTerm(''); // Clear previous search when opening
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className={`custom-dropdown ${className}`} ref={dropdownRef} style={style}>
            <div
                className={`custom-dropdown-header ${isOpen ? 'open' : ''}`}
                onClick={handleHeaderClick}
            >
                {searchable && isOpen ? (
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Backspace' && searchTerm === '') {
                                onChange(''); // Clear value on backspace if search is empty
                            }
                        }}
                        placeholder="Type to search..."
                        className="custom-dropdown-search-input"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                    />
                ) : (
                    <span style={{ color: !selectedOption ? '#a0aec0' : 'inherit' }}>
                        {selectedOption?.label || placeholder}
                    </span>
                )}

                <svg
                    className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
                    width="12"
                    height="8"
                    viewBox="0 0 12 8"
                    fill="none"
                >
                    <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            {isOpen && (
                <div className="custom-dropdown-list" style={{ maxHeight: maxHeight }}>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option, index) => (
                            <div
                                key={option.value}
                                className={`custom-dropdown-option ${value === option.value ? 'selected' : ''} ${hoveredIndex === index ? 'hovered' : ''}`}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                {option.label}
                            </div>
                        ))
                    ) : (
                        <div className="custom-dropdown-option no-results" style={{ color: '#a0aec0', cursor: 'default' }}>
                            No results found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;
