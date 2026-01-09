import { Injectable } from '@nestjs/common';

export interface RandomAnalysis {
  email: string;
  localPart: string;
  isRandom: boolean;
  score: number;
  metrics: {
    entropy: number;
    digitRatio: number;
    vowelRatio: number;
    consecutiveConsonants: number;
    length: number;
  };
  threshold: {
    entropy:  number;
    digitRatio:  number;
    vowelRatio: number;
    consecutiveConsonants: number;
  };
  details: string;
}

@Injectable()
export class RandomDetectionService {
  /**
   * Seuils de détection
   */
  private readonly THRESHOLDS = {
    minLength: 8,
    entropy: 3.2,
    digitRatio: 0.3,
    vowelRatio: 0.25,
    consecutiveConsonants: 5,
  };

  private readonly vowels = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

  /**
   * Calcul de l'entropie de Shannon
   */
  private shannonEntropy(str: string): number {
    if (! str || str.length === 0) return 0;

    const freq:  Record<string, number> = {};
    for (const c of str) {
      freq[c] = (freq[c] || 0) + 1;
    }

    let entropy = 0;
    for (const c in freq) {
      const p = freq[c] / str. length;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Compter le maximum de consonnes consécutives
   */
  private getMaxConsecutiveConsonants(str: string): number {
    let max = 0;
    let current = 0;

    for (const char of str. toLowerCase()) {
      if (/[a-z]/.test(char) && ! this.vowels.has(char)) {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }

    return max;
  }

  /**
   * Détection basique :  local part aléatoire ? 
   * Logique "2 sur 4" : si au moins 2 critères sont remplis → random
   */
  private looksRandomLocalPart(local: string): boolean {
    const clean = local.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (clean.length < this.THRESHOLDS.minLength) {
      return false;
    }

    const entropy = this.shannonEntropy(clean);
    const digitRatio = clean.replace(/[^0-9]/g, '').length / clean.length;
    const vowelRatio = clean.replace(/[^aeiouy]/g, '').length / clean.length;
    const consecutiveConsonants = this.getMaxConsecutiveConsonants(clean);

    // Compter combien de critères sont remplis
    let criteriaMetCount = 0;

    if (entropy > this.THRESHOLDS.entropy) {
      criteriaMetCount++;
    }

    if (digitRatio > this.THRESHOLDS.digitRatio) {
      criteriaMetCount++;
    }

    if (vowelRatio < this. THRESHOLDS.vowelRatio) {
      criteriaMetCount++;
    }

    if (consecutiveConsonants >= this.THRESHOLDS.consecutiveConsonants) {
      criteriaMetCount++;
    }

    // Random si au moins 2 critères sur 4 sont remplis
    return criteriaMetCount >= 2;
  }

  /**
   * Analyse complète d'un email
   */
  async checkEmail(email: string): Promise<RandomAnalysis> {
    const localPart = email.split('@')[0] || email;
    const clean = localPart.toLowerCase().replace(/[^a-z0-9]/g, '');

    const entropy = this.shannonEntropy(clean);
    const digitRatio = clean.length > 0 
      ? clean.replace(/[^0-9]/g, '').length / clean.length 
      : 0;
    const vowelRatio = clean. length > 0 
      ?  clean.replace(/[^aeiouy]/g, '').length / clean.length 
      :  0;
    const consecutiveConsonants = this.getMaxConsecutiveConsonants(clean);

    const isRandom = this.looksRandomLocalPart(localPart);

    // Calculer un score de confiance (0-100)
    let score = 0;

    if (clean.length >= this.THRESHOLDS.minLength) {
      // Entropie (0-25 points)
      if (entropy > this.THRESHOLDS.entropy) {
        score += Math.min(25, (entropy - this.THRESHOLDS.entropy) * 15);
      }

      // Ratio de chiffres (0-25 points)
      if (digitRatio > this.THRESHOLDS.digitRatio) {
        score += Math.min(25, (digitRatio - this. THRESHOLDS.digitRatio) * 80);
      }

      // Ratio de voyelles inversé (0-25 points)
      if (vowelRatio < this.THRESHOLDS.vowelRatio) {
        score += Math.min(25, (this.THRESHOLDS.vowelRatio - vowelRatio) * 100);
      }

      // Consonnes consécutives (0-25 points)
      if (consecutiveConsonants >= this. THRESHOLDS.consecutiveConsonants) {
        score += Math.min(25, (consecutiveConsonants - this.THRESHOLDS.consecutiveConsonants + 1) * 5);
      }
    }

    score = Math.min(100, Math.round(score));

    // Construire le message
    let details = '';
    if (! isRandom) {
      details = 'Email appears legitimate';
    } else {
      const reasons:  string[] = [];
      if (entropy > this.THRESHOLDS.entropy) {
        reasons.push(`high entropy (${entropy.toFixed(2)})`);
      }
      if (digitRatio > this. THRESHOLDS.digitRatio) {
        reasons.push(`too many digits (${(digitRatio * 100).toFixed(0)}%)`);
      }
      if (vowelRatio < this.THRESHOLDS.vowelRatio) {
        reasons.push(`few vowels (${(vowelRatio * 100).toFixed(0)}%)`);
      }
      if (consecutiveConsonants >= this. THRESHOLDS.consecutiveConsonants) {
        reasons.push(`${consecutiveConsonants} consecutive consonants`);
      }
      details = `Likely random: ${reasons.join(', ')}`;
    }

    return {
      email,
      localPart,
      isRandom,
      score,
      metrics: {
        entropy:  Math.round(entropy * 100) / 100,
        digitRatio: Math.round(digitRatio * 100) / 100,
        vowelRatio:  Math.round(vowelRatio * 100) / 100,
        consecutiveConsonants,
        length: clean.length,
      },
      threshold: {
        entropy: this.THRESHOLDS.entropy,
        digitRatio: this. THRESHOLDS.digitRatio,
        vowelRatio:  this.THRESHOLDS.vowelRatio,
        consecutiveConsonants: this.THRESHOLDS.consecutiveConsonants,
      },
      details,
    };
  }
}