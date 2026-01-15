import { AnalyzedOperation, RiskLevel, RiskLevelType, QueryAnalysis, RiskBadge, RiskColors } from '../interfaces';

export const RISK_ORDER: RiskLevelType[] = [
    RiskLevel.SAFE,
    RiskLevel.LOW,
    RiskLevel.MEDIUM,
    RiskLevel.HIGH,
    RiskLevel.CRITICAL,
];

/**
 * Calculate overall risk from operations (takes highest)
 */
export function calculateOverallRisk(operations: AnalyzedOperation[]): RiskLevelType {
    let highestRiskIndex = 0;

    for (const op of operations) {
        const riskIndex = RISK_ORDER.indexOf(op.risk);
        if (riskIndex > highestRiskIndex) {
            highestRiskIndex = riskIndex;
        }
    }

    return RISK_ORDER[highestRiskIndex];
}

/**
 * Generate a human-readable summary of the analysis
 */
export function generateSummary(analysis: QueryAnalysis): string {
    if (analysis.operations.length === 0) {
        return 'No operations detected.';
    }

    const opNames = analysis.operations.map(op => op.operation).join(', ');
    const criticalOps = analysis.operations.filter(op => op.risk === RiskLevel.CRITICAL);
    const highOps = analysis.operations.filter(op => op.risk === RiskLevel.HIGH);

    if (criticalOps.length > 0) {
        return `CRITICAL RISK: Contains ${criticalOps.length} critical operation(s) (${criticalOps.map(op => op.operation).join(', ')}). Requires explicit manager approval.`;
    }

    if (highOps.length > 0) {
        return `HIGH RISK: Contains ${highOps.length} high-risk operation(s) (${highOps.map(op => op.operation).join(', ')}). Use with caution.`;
    }

    if (analysis.overallRisk === RiskLevel.MEDIUM) {
        return `Medium risk query performing: ${opNames}.`;
    }

    if (analysis.overallRisk === RiskLevel.LOW) {
        return `Low risk query performing: ${opNames}.`;
    }

    return `Safe query performing: ${opNames}.`;
}

/**
 * Get risk badge for UI display
 */
export function getRiskBadge(risk: RiskLevelType): RiskBadge {
    switch (risk) {
        case RiskLevel.CRITICAL:
            return {
                label: 'CRITICAL',
                color: '#FFFFFF',
                bgColor: RiskColors.critical,
                icon: '🛑',
            };
        case RiskLevel.HIGH:
            return {
                label: 'HIGH',
                color: '#FFFFFF',
                bgColor: RiskColors.high,
                icon: '⚠️',
            };
        case RiskLevel.MEDIUM:
            return {
                label: 'MEDIUM',
                color: '#000000',
                bgColor: RiskColors.medium,
                icon: '⚠️',
            };
        case RiskLevel.LOW:
            return {
                label: 'LOW',
                color: '#FFFFFF',
                bgColor: RiskColors.low,
                icon: 'ℹ️',
            };
        case RiskLevel.SAFE:
            return {
                label: 'SAFE',
                color: '#FFFFFF',
                bgColor: RiskColors.safe,
                icon: '✅',
            };
        default:
            return {
                label: 'UNKNOWN',
                color: '#000000',
                bgColor: '#E2E8F0',
                icon: '❓',
            };
    }
}
