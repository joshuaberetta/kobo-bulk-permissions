import { describe, it, expect } from 'vitest';

// Test helper functions for filter parsing and formatting

/**
 * Helper function to simulate parseFilterFieldsAndValues behavior
 */
function parseFilterFieldsAndValues(filterField, filterValue) {
  const filters = [];
  
  // Check if filterValue contains '=' (new format with field=value pairs)
  if (filterValue.includes('=')) {
    // New format: parse "field1=value1,value2;field2=value3"
    const fieldValuePairs = filterValue.split(';').map(p => p.trim()).filter(p => p);
    
    for (const pair of fieldValuePairs) {
      const [field, values] = pair.split('=').map(s => s.trim());
      if (field && values) {
        // Split values by comma for multiple values per field
        const valueList = values.split(',').map(v => v.trim()).filter(v => v);
        for (const value of valueList) {
          filters.push({ [field]: value });
        }
      }
    }
  } else {
    // Legacy format: single field with comma-separated values
    if (filterField && filterValue) {
      const values = filterValue.split(',').map(v => v.trim()).filter(v => v);
      for (const value of values) {
        filters.push({ [filterField]: value });
      }
    }
  }
  
  return filters;
}

/**
 * Helper function to simulate formatFiltersForExport behavior
 */
function formatFiltersForExport(filters) {
  if (!filters || filters.length === 0) {
    return { filterField: '', filterValue: '' };
  }
  
  // Group filters by field name
  const fieldGroups = {};
  
  for (const filter of filters) {
    const field = Object.keys(filter)[0];
    const value = filter[field];
    
    if (field && value) {
      if (!fieldGroups[field]) {
        fieldGroups[field] = [];
      }
      if (!fieldGroups[field].includes(value)) {
        fieldGroups[field].push(value);
      }
    }
  }
  
  const fieldNames = Object.keys(fieldGroups);
  
  // If only one field, use legacy format for backwards compatibility
  if (fieldNames.length === 1) {
    const field = fieldNames[0];
    return {
      filterField: field,
      filterValue: fieldGroups[field].join(',')
    };
  }
  
  // Multiple fields: use new format "field1=value1,value2;field2=value3"
  const pairs = fieldNames.map(field => 
    `${field}=${fieldGroups[field].join(',')}`
  );
  
  return {
    filterField: '',  // Empty for new format
    filterValue: pairs.join(';')
  };
}

describe('Filter Parsing and Formatting', () => {
  
  describe('parseFilterFieldsAndValues - Legacy Format', () => {
    it('should parse single field with single value', () => {
      const filters = parseFilterFieldsAndValues('sector', 'wash');
      expect(filters).toEqual([{ sector: 'wash' }]);
    });
    
    it('should parse single field with multiple values', () => {
      const filters = parseFilterFieldsAndValues('sector', 'wash,protection');
      expect(filters).toEqual([
        { sector: 'wash' },
        { sector: 'protection' }
      ]);
    });
    
    it('should handle values with spaces', () => {
      const filters = parseFilterFieldsAndValues('sector', 'wash, protection, health');
      expect(filters).toEqual([
        { sector: 'wash' },
        { sector: 'protection' },
        { sector: 'health' }
      ]);
    });
  });
  
  describe('parseFilterFieldsAndValues - New Format', () => {
    it('should parse multiple fields with single values', () => {
      const filters = parseFilterFieldsAndValues('', 'sector=wash;province=gaza');
      expect(filters).toEqual([
        { sector: 'wash' },
        { province: 'gaza' }
      ]);
    });
    
    it('should parse multiple fields with multiple values', () => {
      const filters = parseFilterFieldsAndValues('', 'sector=wash,protection;province=gaza,rafah');
      expect(filters).toEqual([
        { sector: 'wash' },
        { sector: 'protection' },
        { province: 'gaza' },
        { province: 'rafah' }
      ]);
    });
    
    it('should handle complex multi-field scenarios', () => {
      const filters = parseFilterFieldsAndValues('', 'sector=wash;province=gaza;district=north,south');
      expect(filters).toEqual([
        { sector: 'wash' },
        { province: 'gaza' },
        { district: 'north' },
        { district: 'south' }
      ]);
    });
    
    it('should handle values with spaces', () => {
      const filters = parseFilterFieldsAndValues('', 'sector=wash, protection; province=gaza');
      expect(filters).toEqual([
        { sector: 'wash' },
        { sector: 'protection' },
        { province: 'gaza' }
      ]);
    });
  });
  
  describe('formatFiltersForExport - Single Field', () => {
    it('should export single field in legacy format', () => {
      const filters = [
        { sector: 'wash' },
        { sector: 'protection' }
      ];
      const result = formatFiltersForExport(filters);
      expect(result).toEqual({
        filterField: 'sector',
        filterValue: 'wash,protection'
      });
    });
    
    it('should handle single field with single value', () => {
      const filters = [{ sector: 'wash' }];
      const result = formatFiltersForExport(filters);
      expect(result).toEqual({
        filterField: 'sector',
        filterValue: 'wash'
      });
    });
    
    it('should deduplicate values', () => {
      const filters = [
        { sector: 'wash' },
        { sector: 'wash' },
        { sector: 'protection' }
      ];
      const result = formatFiltersForExport(filters);
      expect(result).toEqual({
        filterField: 'sector',
        filterValue: 'wash,protection'
      });
    });
  });
  
  describe('formatFiltersForExport - Multiple Fields', () => {
    it('should export multiple fields in new format', () => {
      const filters = [
        { sector: 'wash' },
        { province: 'gaza' }
      ];
      const result = formatFiltersForExport(filters);
      expect(result).toEqual({
        filterField: '',
        filterValue: 'sector=wash;province=gaza'
      });
    });
    
    it('should export multiple fields with multiple values', () => {
      const filters = [
        { sector: 'wash' },
        { sector: 'protection' },
        { province: 'gaza' },
        { province: 'rafah' }
      ];
      const result = formatFiltersForExport(filters);
      expect(result).toEqual({
        filterField: '',
        filterValue: 'sector=wash,protection;province=gaza,rafah'
      });
    });
    
    it('should handle complex multi-field scenarios', () => {
      const filters = [
        { sector: 'wash' },
        { province: 'gaza' },
        { district: 'north' },
        { district: 'south' }
      ];
      const result = formatFiltersForExport(filters);
      expect(result).toEqual({
        filterField: '',
        filterValue: 'sector=wash;province=gaza;district=north,south'
      });
    });
  });
  
  describe('Round-trip conversion', () => {
    it('should maintain data through parse->format->parse cycle (single field)', () => {
      const original = parseFilterFieldsAndValues('sector', 'wash,protection');
      const exported = formatFiltersForExport(original);
      const reimported = parseFilterFieldsAndValues(exported.filterField, exported.filterValue);
      
      expect(reimported).toEqual(original);
    });
    
    it('should maintain data through parse->format->parse cycle (multiple fields)', () => {
      const original = parseFilterFieldsAndValues('', 'sector=wash,protection;province=gaza');
      const exported = formatFiltersForExport(original);
      const reimported = parseFilterFieldsAndValues(exported.filterField, exported.filterValue);
      
      expect(reimported).toEqual(original);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty filters', () => {
      const result = formatFiltersForExport([]);
      expect(result).toEqual({ filterField: '', filterValue: '' });
    });
    
    it('should handle null/undefined filters', () => {
      const result = formatFiltersForExport(null);
      expect(result).toEqual({ filterField: '', filterValue: '' });
    });
    
    it('should handle empty values in new format', () => {
      const filters = parseFilterFieldsAndValues('', '');
      expect(filters).toEqual([]);
    });
    
    it('should handle empty values in legacy format', () => {
      const filters = parseFilterFieldsAndValues('sector', '');
      expect(filters).toEqual([]);
    });
  });
});
