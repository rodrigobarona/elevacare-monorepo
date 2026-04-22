import { cn } from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
      expect(cn('class1', undefined, 'class2')).toBe('class1 class2');

      // Test with conditional classes using variables
      const shouldAddClass2 = false;
      const shouldAddClass3 = true;
      expect(cn('class1', shouldAddClass2 && 'class2', shouldAddClass3 && 'class3')).toBe(
        'class1 class3',
      );

      // Test with conditional classes
      const isActive = true;
      const isDisabled = false;

      expect(cn('base-class', isActive && 'active', isDisabled && 'disabled')).toBe(
        'base-class active',
      );

      // Test with tailwind-like class conflicts
      expect(cn('p-4', 'p-2')).toContain('p-2');
      expect(cn('p-4', 'p-2')).not.toContain('p-4');
    });

    it('should handle objects for conditional classes', () => {
      expect(cn('base', { active: true, disabled: false })).toBe('base active');

      const buttonStyles = {
        btn: true,
        'btn-primary': true,
        'btn-large': false,
        'btn-disabled': false,
      };

      expect(cn(buttonStyles)).toBe('btn btn-primary');
    });

    it('should handle arrays', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2');

      // Test with conditional array items using variables
      const includeClass2 = false;
      const includeClass3 = true;
      expect(cn(['class1', includeClass2 && 'class2', includeClass3 && 'class3'])).toBe(
        'class1 class3',
      );
    });

    it('should handle empty or falsy inputs', () => {
      expect(cn('')).toBe('');
      expect(cn(null)).toBe('');
      expect(cn(undefined)).toBe('');

      // Test with conditional using variable
      const shouldIncludeClass = false;
      expect(cn(shouldIncludeClass && 'class')).toBe('');
    });
  });
});
