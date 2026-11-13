import type { StatusTone } from '@/components/admin/StatusPill';
import type { WholesaleApplication, WholesaleApplicationStatus } from '@/types/api';

export function wholesaleStatusTone(status: WholesaleApplicationStatus): StatusTone {
    if (status === 'PENDING') return 'warning';
    if (status === 'NEEDS_INFO') return 'info';
    if (status === 'APPROVED') return 'success';
    if (status === 'REJECTED' || status === 'REVOKED') return 'danger';
    return 'neutral';
}

export function cnpjLookupTone(status: WholesaleApplication['cnpjLookupStatus']): StatusTone {
    if (status === 'OK') return 'success';
    if (status === 'ALERT') return 'danger';
    return 'neutral';
}

/** Influencer pendente ou aprovado: a aprovação é recusada pelo backend (D14). */
export function blocksApproval(application: WholesaleApplication) {
    return application.influencerStatus === 'PENDING' || application.influencerStatus === 'APPROVED';
}

/** O resumo da Receita que o backend grava (BrasilAPI). Campos ausentes viram nulos. */
export interface CnpjLookupSummary {
    found: boolean | null;
    divergences: string[];
    note: string | null;
    situation: string | null;
    situationDate: string | null;
    situationReason: string | null;
    legalName: string | null;
    tradeName: string | null;
    openedAt: string | null;
    legalNature: string | null;
    size: string | null;
    cnae: string | null;
    simples: boolean | null;
    mei: boolean | null;
    state: string | null;
    city: string | null;
    address: string | null;
    postalCode: string | null;
    partners: { name: string; role: string | null }[];
}

function str(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function flag(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

/** Lê o jsonb da consulta. Nulo quando não é o formato conhecido (dado antigo). */
export function readCnpjLookup(data: WholesaleApplication['cnpjLookup']): CnpjLookupSummary | null {
    if (!data || typeof data.fonte !== 'string') return null;
    const partners = Array.isArray(data.socios)
        ? data.socios.flatMap((partner: unknown) => {
              if (!partner || typeof partner !== 'object') return [];
              const record = partner as Record<string, unknown>;
              const name = str(record.nome);
              return name ? [{ name, role: str(record.qualificacao) }] : [];
          })
        : [];
    return {
        found: flag(data.encontrado),
        divergences: Array.isArray(data.divergencias)
            ? data.divergencias.filter((item): item is string => typeof item === 'string')
            : [],
        note: str(data.observacao),
        situation: str(data.situacao),
        situationDate: str(data.dataSituacao),
        situationReason: str(data.motivoSituacao),
        legalName: str(data.razaoSocial),
        tradeName: str(data.nomeFantasia),
        openedAt: str(data.abertura),
        legalNature: str(data.naturezaJuridica),
        size: str(data.porte),
        cnae: str(data.cnae),
        simples: flag(data.simples),
        mei: flag(data.mei),
        state: str(data.uf),
        city: str(data.municipio),
        address: str(data.endereco),
        postalCode: str(data.cep),
        partners,
    };
}

/** `2020-01-31` → `31/01/2020`. A Receita manda só a data, sem fuso. */
export function formatIsoDay(value: string | null): string | null {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
