'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { Supplier, SupplierKind, SupplierModality, SupplierStatus } from '@/types/api';
import { MODALITY_PRESETS, SUPPLIER_CURRENCIES, SUPPLIER_KINDS, SUPPLIER_STATUSES } from './supplier-format';

interface ContactDraft {
    key: number;
    name: string;
    role: string;
    phone: string;
    email: string;
    wechat: string;
    notes: string;
}

interface Draft {
    kind: SupplierKind;
    status: SupplierStatus;
    name: string;
    country: string;
    city: string;
    website: string;
    supplies: string;
    modalities: string[];
    contacts: ContactDraft[];
    strengths: string;
    weaknesses: string;
    notes: string;
    minOrder: string;
    leadTime: string;
    paymentTerms: string;
    currency: string;
    priceReference: string;
}

let contactKey = 0;

function emptyContact(): ContactDraft {
    contactKey += 1;
    return { key: contactKey, name: '', role: '', phone: '', email: '', wechat: '', notes: '' };
}

function emptyDraft(): Draft {
    return {
        kind: 'PRODUCT',
        status: 'EVALUATING',
        name: '',
        country: '',
        city: '',
        website: '',
        supplies: '',
        modalities: [],
        contacts: [emptyContact()],
        strengths: '',
        weaknesses: '',
        notes: '',
        minOrder: '',
        leadTime: '',
        paymentTerms: '',
        currency: '',
        priceReference: '',
    };
}

function draftOf(supplier: Supplier): Draft {
    return {
        kind: supplier.kind,
        status: supplier.status,
        name: supplier.name,
        country: supplier.country ?? '',
        city: supplier.city ?? '',
        website: supplier.website ?? '',
        supplies: supplier.supplies ?? '',
        modalities: supplier.modalities,
        contacts: supplier.contacts.map((contact) => ({
            ...emptyContact(),
            name: contact.name,
            role: contact.role ?? '',
            phone: contact.phone ?? '',
            email: contact.email ?? '',
            wechat: contact.wechat ?? '',
            notes: contact.notes ?? '',
        })),
        strengths: supplier.strengths ?? '',
        weaknesses: supplier.weaknesses ?? '',
        notes: supplier.notes ?? '',
        minOrder: supplier.minOrder ?? '',
        leadTime: supplier.leadTime ?? '',
        paymentTerms: supplier.paymentTerms ?? '',
        currency: supplier.currency ?? '',
        priceReference: supplier.priceReference ?? '',
    };
}

/**
 * Cadastro e edição do fornecedor numa página só, em blocos: empresa, o que
 * fornece, contatos, avaliação e condições. O corpo vai sempre inteiro; campo
 * vazio é limpo no backend.
 */
export function SupplierEditorPage() {
    const params = useParams<{ id?: string }>();
    const id = params.id;
    const router = useRouter();
    const { t } = useTranslation();
    const { notify } = useToast();
    const [draft, setDraft] = useState<Draft | undefined>(id ? undefined : emptyDraft());
    const [loadError, setLoadError] = useState<string>();
    const [saveError, setSaveError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [attempted, setAttempted] = useState(false);
    const [modalityText, setModalityText] = useState('');
    const [usedModalities, setUsedModalities] = useState<SupplierModality[]>([]);
    // Versão aberta no formulário: o backend recusa (409) se outra pessoa salvou no meio.
    const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string>();
    const saveErrorRef = useRef<HTMLDivElement>(null);

    // O botão Salvar fica no fim da página e o aviso no topo: sem rolar, o
    // erro (inclusive o 409 de edição simultânea) passava despercebido.
    useEffect(() => {
        if (saveError) saveErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [saveError]);

    useEffect(() => {
        if (!id) return;
        api<Supplier>(`/suppliers/${id}`)
            .then((supplier) => {
                setDraft(draftOf(supplier));
                setLoadedUpdatedAt(supplier.updatedAt);
            })
            .catch((err) =>
                setLoadError(
                    err instanceof ApiError && err.status === 404
                        ? t('suppliers.detail.notFound')
                        : t('suppliers.error'),
                ),
            );
    }, [id, t]);

    useEffect(() => {
        api<SupplierModality[]>('/suppliers/modalities')
            .then(setUsedModalities)
            .catch(() => setUsedModalities([]));
    }, []);

    const suggestions = useMemo(() => {
        if (!draft) return [];
        const pool = [
            ...MODALITY_PRESETS[draft.kind],
            ...usedModalities.filter((item) => item.kind === draft.kind).map((item) => item.modality),
        ];
        const chosen = new Set(draft.modalities.map((name) => name.toLowerCase()));
        const seen = new Set<string>();
        return pool.filter((name) => {
            const lower = name.toLowerCase();
            if (chosen.has(lower) || seen.has(lower)) return false;
            seen.add(lower);
            return true;
        });
    }, [draft, usedModalities]);

    const backHref = id ? `/admin/fornecedores/${id}` : '/admin/fornecedores';
    const title = id ? t('suppliers.form.editTitle') : t('suppliers.form.createTitle');

    if (loadError)
        return (
            <div className="grid gap-6">
                <PageHeader backHref={backHref} backLabel={t('suppliers.detail.back')} title={title} />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{loadError}</p>
                </Alert>
            </div>
        );

    if (!draft)
        return (
            <div className="grid gap-6">
                <PageHeader backHref={backHref} backLabel={t('suppliers.detail.back')} title={title} />
                <SkeletonCards label={t('common.loading')} />
            </div>
        );

    const current = draft;
    const update = <K extends keyof Draft>(field: K, value: Draft[K]) =>
        setDraft((previous) => (previous ? { ...previous, [field]: value } : previous));
    const updateContact = (key: number, field: keyof Omit<ContactDraft, 'key'>, value: string) =>
        update(
            'contacts',
            current.contacts.map((contact) => (contact.key === key ? { ...contact, [field]: value } : contact)),
        );

    function addModality(raw: string) {
        const name = raw.trim().slice(0, 60);
        if (!name) return;
        if (current.modalities.some((existing) => existing.toLowerCase() === name.toLowerCase())) return;
        update('modalities', [...current.modalities, name]);
    }

    function handleModalityKey(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addModality(modalityText);
            setModalityText('');
        }
    }

    const nameMissing = current.name.trim() === '';
    const contactMissing = (contact: ContactDraft) =>
        contact.name.trim() === '' &&
        [contact.role, contact.phone, contact.email, contact.wechat, contact.notes].some((value) => value.trim());

    async function submit(event: FormEvent) {
        event.preventDefault();
        setAttempted(true);
        if (nameMissing || current.contacts.some(contactMissing)) {
            // O erro só aparece no próximo render; leva o foco ao primeiro campo marcado.
            requestAnimationFrame(() => document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus());
            return;
        }

        // Linha de contato toda em branco é só o espaço vazio do formulário.
        const contacts = current.contacts
            .filter((contact) => contact.name.trim())
            .map(({ key, ...contact }) => {
                void key;
                return contact;
            });
        const pending = modalityText.trim();
        const modalities =
            pending && !current.modalities.some((name) => name.toLowerCase() === pending.toLowerCase())
                ? [...current.modalities, pending]
                : current.modalities;

        setSaving(true);
        setSaveError(undefined);
        try {
            const saved = await api<Supplier>(id ? `/suppliers/${id}` : '/suppliers', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...current,
                    contacts,
                    modalities,
                    ...(id ? { expectedUpdatedAt: loadedUpdatedAt } : {}),
                }),
            });
            notify({
                tone: 'success',
                title: t(id ? 'suppliers.form.updatedToast' : 'suppliers.form.createdToast'),
            });
            router.push(`/admin/fornecedores/${saved.id}`);
        } catch (err) {
            setSaveError(
                err instanceof ApiError
                    ? err.status === 403
                        ? t('suppliers.forbidden')
                        : err.message
                    : t('suppliers.form.saveError'),
            );
            setSaving(false);
        }
    }

    return (
        <form className="grid gap-6" noValidate onSubmit={submit}>
            <PageHeader
                backHref={backHref}
                backLabel={t('suppliers.detail.back')}
                kicker={t('suppliers.kicker')}
                title={id ? current.name || title : title}
            />

            {saveError && (
                <div ref={saveErrorRef}>
                    <Alert tone="danger" title={t('suppliers.form.saveError')}>
                        <p>{saveError}</p>
                    </Alert>
                </div>
            )}

            <SectionCard title={t('suppliers.form.identity')}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                        label={t('suppliers.form.kind')}
                        onChange={(event) => update('kind', event.target.value as SupplierKind)}
                        options={SUPPLIER_KINDS.map((value) => ({ value, label: t(`suppliers.kinds.${value}`) }))}
                        required
                        value={current.kind}
                    />
                    <Select
                        hint={t(`suppliers.statusHints.${current.status}`)}
                        label={t('suppliers.form.status')}
                        onChange={(event) => update('status', event.target.value as SupplierStatus)}
                        options={SUPPLIER_STATUSES.map((value) => ({
                            value,
                            label: t(`suppliers.statuses.${value}`),
                        }))}
                        required
                        value={current.status}
                    />
                    <Input
                        error={attempted && nameMissing ? t('suppliers.form.nameRequired') : undefined}
                        fieldClassName="sm:col-span-2"
                        label={t('suppliers.form.name')}
                        maxLength={160}
                        onChange={(event) => update('name', event.target.value)}
                        required
                        value={current.name}
                    />
                    <Input
                        label={t('suppliers.form.country')}
                        maxLength={80}
                        onChange={(event) => update('country', event.target.value)}
                        placeholder={t('suppliers.form.countryPlaceholder')}
                        value={current.country}
                    />
                    <Input
                        label={t('suppliers.form.city')}
                        maxLength={120}
                        onChange={(event) => update('city', event.target.value)}
                        value={current.city}
                    />
                    <Input
                        fieldClassName="sm:col-span-2"
                        hint={t('suppliers.form.websiteHint')}
                        inputMode="url"
                        label={t('suppliers.form.website')}
                        maxLength={500}
                        onChange={(event) => update('website', event.target.value)}
                        placeholder="https://"
                        type="url"
                        value={current.website}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('suppliers.form.offer')}>
                <div className="grid gap-4">
                    <Textarea
                        label={t('suppliers.form.supplies')}
                        maxLength={4000}
                        onChange={(event) => update('supplies', event.target.value)}
                        placeholder={t('suppliers.form.suppliesPlaceholder')}
                        rows={3}
                        value={current.supplies}
                    />
                    <div className="grid gap-2">
                        <Input
                            hint={t('suppliers.form.modalitiesHint')}
                            label={t('suppliers.form.modalities')}
                            maxLength={60}
                            onBlur={() => {
                                addModality(modalityText);
                                setModalityText('');
                            }}
                            onChange={(event) => setModalityText(event.target.value)}
                            onKeyDown={handleModalityKey}
                            placeholder={t('suppliers.form.modalityPlaceholder')}
                            value={modalityText}
                        />
                        {current.modalities.length > 0 && (
                            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                                {current.modalities.map((name) => (
                                    <li key={name}>
                                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-brand-50 py-0.5 pr-1 pl-2.5 text-xs font-semibold text-brand-800 dark:border-night-accent/40 dark:bg-night-brand dark:text-night-text">
                                            {name}
                                            <button
                                                aria-label={t('suppliers.form.removeModality', { name })}
                                                className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-night-raised"
                                                onClick={() =>
                                                    update(
                                                        'modalities',
                                                        current.modalities.filter((item) => item !== name),
                                                    )
                                                }
                                                type="button"
                                            >
                                                <X className="h-3 w-3" aria-hidden="true" />
                                            </button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {suggestions.length > 0 && (
                            <div className="grid gap-1.5">
                                <span className="text-xs text-muted dark:text-night-muted">
                                    {t('suppliers.form.suggestions')}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {suggestions.map((name) => (
                                        <button
                                            className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-xs text-muted hover:border-brand-300 hover:text-ink dark:border-night-line dark:text-night-muted dark:hover:text-night-text"
                                            key={name}
                                            onClick={() => addModality(name)}
                                            type="button"
                                        >
                                            <Plus className="h-3 w-3" aria-hidden="true" />
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                action={
                    <Button
                        leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => update('contacts', [...current.contacts, emptyContact()])}
                        size="small"
                        type="button"
                        variant="secondary"
                    >
                        {t('suppliers.form.addContact')}
                    </Button>
                }
                description={t('suppliers.form.contactsHint')}
                title={t('suppliers.form.contacts')}
            >
                <div className="grid gap-4">
                    {current.contacts.map((contact, index) => (
                        <fieldset
                            className="m-0 grid gap-3 rounded-xl border border-line p-4 dark:border-night-line"
                            key={contact.key}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <legend className="float-left text-xs font-semibold tracking-wide text-muted uppercase dark:text-night-muted">
                                    {t('suppliers.form.contactNumber', { number: index + 1 })}
                                </legend>
                                <Button
                                    aria-label={t('suppliers.form.removeContact')}
                                    iconOnly
                                    onClick={() =>
                                        update(
                                            'contacts',
                                            current.contacts.filter((item) => item.key !== contact.key),
                                        )
                                    }
                                    size="small"
                                    type="button"
                                    variant="dangerGhost"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <Input
                                    error={
                                        attempted && contactMissing(contact)
                                            ? t('suppliers.form.contactNameRequired')
                                            : undefined
                                    }
                                    label={t('suppliers.form.contactName')}
                                    maxLength={120}
                                    onChange={(event) => updateContact(contact.key, 'name', event.target.value)}
                                    value={contact.name}
                                />
                                <Input
                                    label={t('suppliers.form.contactRole')}
                                    maxLength={120}
                                    onChange={(event) => updateContact(contact.key, 'role', event.target.value)}
                                    value={contact.role}
                                />
                                <Input
                                    inputMode="tel"
                                    hint={t('suppliers.form.contactPhoneHint')}
                                    label={t('suppliers.form.contactPhone')}
                                    maxLength={60}
                                    onChange={(event) => updateContact(contact.key, 'phone', event.target.value)}
                                    placeholder="+86 …"
                                    type="tel"
                                    value={contact.phone}
                                />
                                <Input
                                    label={t('suppliers.form.contactEmail')}
                                    maxLength={200}
                                    onChange={(event) => updateContact(contact.key, 'email', event.target.value)}
                                    type="email"
                                    value={contact.email}
                                />
                                <Input
                                    label={t('suppliers.form.contactWechat')}
                                    maxLength={120}
                                    onChange={(event) => updateContact(contact.key, 'wechat', event.target.value)}
                                    value={contact.wechat}
                                />
                                <Input
                                    label={t('suppliers.form.contactNotes')}
                                    maxLength={500}
                                    onChange={(event) => updateContact(contact.key, 'notes', event.target.value)}
                                    value={contact.notes}
                                />
                            </div>
                        </fieldset>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('suppliers.form.evaluation')}>
                <div className="grid gap-4 md:grid-cols-2">
                    <Textarea
                        label={t('suppliers.form.strengths')}
                        maxLength={4000}
                        onChange={(event) => update('strengths', event.target.value)}
                        placeholder={t('suppliers.form.strengthsPlaceholder')}
                        rows={5}
                        value={current.strengths}
                    />
                    <Textarea
                        label={t('suppliers.form.weaknesses')}
                        maxLength={4000}
                        onChange={(event) => update('weaknesses', event.target.value)}
                        placeholder={t('suppliers.form.weaknessesPlaceholder')}
                        rows={5}
                        value={current.weaknesses}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('suppliers.form.commercial')}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                        label={t('suppliers.form.minOrder')}
                        maxLength={300}
                        onChange={(event) => update('minOrder', event.target.value)}
                        placeholder={t('suppliers.form.minOrderPlaceholder')}
                        value={current.minOrder}
                    />
                    <Input
                        label={t('suppliers.form.leadTime')}
                        maxLength={300}
                        onChange={(event) => update('leadTime', event.target.value)}
                        placeholder={t('suppliers.form.leadTimePlaceholder')}
                        value={current.leadTime}
                    />
                    <Input
                        label={t('suppliers.form.paymentTerms')}
                        maxLength={300}
                        onChange={(event) => update('paymentTerms', event.target.value)}
                        placeholder={t('suppliers.form.paymentTermsPlaceholder')}
                        value={current.paymentTerms}
                    />
                    <Select
                        label={t('suppliers.form.currency')}
                        onChange={(event) => update('currency', event.target.value)}
                        options={[
                            ...SUPPLIER_CURRENCIES.map((code) => ({ value: code, label: code })),
                            ...(current.currency &&
                            !SUPPLIER_CURRENCIES.includes(current.currency as (typeof SUPPLIER_CURRENCIES)[number])
                                ? [{ value: current.currency, label: current.currency }]
                                : []),
                        ]}
                        placeholderOption={t('suppliers.form.noCurrency')}
                        value={current.currency}
                    />
                    <Textarea
                        fieldClassName="sm:col-span-2"
                        label={t('suppliers.form.priceReference')}
                        maxLength={4000}
                        onChange={(event) => update('priceReference', event.target.value)}
                        placeholder={t('suppliers.form.priceReferencePlaceholder')}
                        rows={3}
                        value={current.priceReference}
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('suppliers.form.notes')}>
                <Textarea
                    hideLabel
                    label={t('suppliers.form.notes')}
                    maxLength={8000}
                    onChange={(event) => update('notes', event.target.value)}
                    placeholder={t('suppliers.form.notesPlaceholder')}
                    rows={5}
                    value={current.notes}
                />
            </SectionCard>

            <div className="flex flex-wrap justify-end gap-3">
                <ButtonLink href={backHref} variant="secondary">
                    {t('suppliers.form.cancel')}
                </ButtonLink>
                <Button loading={saving} type="submit">
                    {id ? t('suppliers.form.save') : t('suppliers.form.create')}
                </Button>
            </div>
        </form>
    );
}
