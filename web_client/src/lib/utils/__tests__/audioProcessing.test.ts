/**
 * audioProcessing.ts 单元测试
 */

import { float32ToInt16 } from '../audioProcessing';

describe('audioProcessing', () => {
  describe('float32ToInt16', () => {
    it('应该正确转换正常范围的 Float32 值', () => {
      const input = new Float32Array([0, 0.5, 1.0, -0.5, -1.0]);
      const result = float32ToInt16(input);

      expect(result[0]).toBe(0);          // 0 → 0
      expect(result[1]).toBe(16383);      // 0.5 → 16383 (0.5 * 32767)
      expect(result[2]).toBe(32767);      // 1.0 → 32767
      expect(result[3]).toBe(-16384);     // -0.5 → -16384 (-0.5 * 32768)
      expect(result[4]).toBe(-32768);     // -1.0 → -32768
    });

    it('应该裁剪超出范围的值', () => {
      const input = new Float32Array([1.5, -1.5, 2.0, -2.0]);
      const result = float32ToInt16(input);

      // 所有超出 [-1, 1] 的值应该被裁剪
      expect(result[0]).toBe(32767);   // 1.5 → 1.0 → 32767
      expect(result[1]).toBe(-32768);  // -1.5 → -1.0 → -32768
      expect(result[2]).toBe(32767);   // 2.0 → 1.0 → 32767
      expect(result[3]).toBe(-32768);  // -2.0 → -1.0 → -32768
    });

    it('应该正确处理小数值', () => {
      const input = new Float32Array([0.1, -0.1, 0.001, -0.001]);
      const result = float32ToInt16(input);

      expect(result[0]).toBe(Math.floor(0.1 * 32767));
      expect(result[1]).toBe(Math.ceil(-0.1 * 32768));
      expect(result[2]).toBe(Math.floor(0.001 * 32767));
      expect(result[3]).toBe(Math.ceil(-0.001 * 32768));
    });

    it('应该处理空数组', () => {
      const input = new Float32Array([]);
      const result = float32ToInt16(input);

      expect(result.length).toBe(0);
      expect(result).toBeInstanceOf(Int16Array);
    });

    it('应该处理大数组', () => {
      const size = 4096; // 典型的音频缓冲区大小
      const input = new Float32Array(size);
      
      // 填充随机值
      for (let i = 0; i < size; i++) {
        input[i] = (Math.random() * 2) - 1; // -1.0 ~ 1.0
      }

      const result = float32ToInt16(input);

      expect(result.length).toBe(size);
      expect(result).toBeInstanceOf(Int16Array);
      
      // 验证所有值都在有效范围内
      for (let i = 0; i < size; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(-32768);
        expect(result[i]).toBeLessThanOrEqual(32767);
      }
    });

    it('应该保持对称性：正负值转换应该对称', () => {
      const input = new Float32Array([0.5, -0.5, 0.25, -0.25]);
      const result = float32ToInt16(input);

      // 正负值的绝对值应该大致相等（考虑到 Int16 不对称：-32768 ~ 32767）
      expect(Math.abs(result[0])).toBeCloseTo(Math.abs(result[1]), -1);
      expect(Math.abs(result[2])).toBeCloseTo(Math.abs(result[3]), -1);
    });

    it('应该返回新的 Int16Array 实例', () => {
      const input = new Float32Array([0.1, 0.2, 0.3]);
      const result1 = float32ToInt16(input);
      const result2 = float32ToInt16(input);

      expect(result1).not.toBe(result2); // 不同的实例
      expect(result1).toEqual(result2);  // 但值相同
    });
  });
});

