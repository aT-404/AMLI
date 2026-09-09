<script lang="ts">
	import { onMount } from 'svelte';
	import { pageTitle } from '$lib/utils/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let logsList = $state(data.logs || []);
	let totalCount = $state(data.totalCount || 0);
	let isLoadingMore = $state(false);
	let fetchError = $state<string | null>(null);

	$effect(() => {
		logsList = data.logs || [];
		totalCount = data.totalCount || 0;
	});

	async function loadMorePreviousLogs() {
		isLoadingMore = true;
		fetchError = null;
		try {
			const offset = logsList.length;
			const res = await fetch(`/api/audit-logs/?limit=50&offset=${offset}`);
			if (!res.ok) {
				fetchError = 'Failed to load previous logs.';
				return;
			}
			const resultData = await res.json();
			const newLogs = resultData.results || (Array.isArray(resultData) ? resultData : []);
			logsList = [...logsList, ...newLogs];
			if (resultData.count) {
				totalCount = resultData.count;
			}
		} catch (e: any) {
			fetchError = e.message || 'Error loading more logs.';
		} finally {
			isLoadingMore = false;
		}
	}

	onMount(() => {
		$pageTitle = 'Audit Logs';
	});

	function parseChangesObj(changes: any): Record<string, any> | null {
		if (!changes) return null;
		if (typeof changes === 'object') return changes;
		if (typeof changes === 'string') {
			try {
				return JSON.parse(changes);
			} catch {
				return null;
			}
		}
		return null;
	}

	function getActionBadge(log: any): { label: string; badgeClass: string } {
		const obj = parseChangesObj(log.changes);
		const action = log.action;

		if (obj && (obj.event === 'logout' || obj.logout === true)) {
			return { label: 'LOGOUT', badgeClass: 'variant-filled-secondary' };
		}
		if (obj && (obj.event === 'login' || 'last_login' in obj)) {
			return { label: 'LOGIN', badgeClass: 'variant-filled-info' };
		}
		if (obj && (obj.event === 'export' || obj.export_format)) {
			return { label: 'EXPORT', badgeClass: 'variant-filled-primary' };
		}

		if (action === 0) return { label: 'CREATE', badgeClass: 'variant-filled-success' };
		if (action === 1) return { label: 'UPDATE', badgeClass: 'variant-filled-warning' };
		if (action === 2) return { label: 'DELETE', badgeClass: 'variant-filled-error' };
		return { label: 'ACCESS', badgeClass: 'variant-filled-surface' };
	}

	function formatChanges(changes: any, action: number, modelName: string, objectRepr: string): string {
		const obj = parseChangesObj(changes);
		const lowerModel = (modelName || '').toLowerCase();
		const targetName = objectRepr && objectRepr !== 'None' ? objectRepr : '';

		// 1. LOGIN / LOGOUT
		if (obj && (obj.event === 'logout' || obj.logout === true)) {
			return `User logged out`;
		}
		if (obj && (obj.event === 'login' || 'last_login' in obj)) {
			return `User logged in`;
		}
		if (obj && obj.event === 'export') {
			return `Exported Report - ${obj.format || targetName || 'PDF/Excel'}`;
		}

		// 2. AUDIT / ASSESSMENTS (Compliance Assessment, Risk Assessment, CRQ Assessment, Audit)
		if (
			lowerModel.includes('compliance assessment') ||
			lowerModel.includes('compliance_assessment') ||
			lowerModel.includes('risk assessment') ||
			lowerModel.includes('audit') ||
			lowerModel.includes('crq')
		) {
			if (action === 0) return `Audit Created - ${targetName}`;
			if (action === 2) return `Audit Deleted - ${targetName}`;

			if (obj && obj.status) {
				const statusVal = Array.isArray(obj.status) ? obj.status[1] : obj.status;
				return `Set status to "${statusVal}"`;
			}
			return `Updated Audit - ${targetName}`;
		}

		// 3. CHECKLIST / FRAMEWORK / REQUIREMENT
		if (
			lowerModel.includes('checklist') ||
			lowerModel.includes('accreditation') ||
			lowerModel.includes('framework') ||
			lowerModel.includes('requirement') ||
			lowerModel.includes('control')
		) {
			if (action === 0) return `Checklist Added - ${targetName}`;
			if (action === 2) return `Checklist Deleted - ${targetName}`;
			return `Checklist Updated - ${targetName}`;
		}

		// 4. EVIDENCES & FILES (Evidence, Document, IntermediaryPartnerReport, Partner Report)
		if (
			lowerModel.includes('evidence') ||
			lowerModel.includes('document') ||
			lowerModel.includes('partner report') ||
			lowerModel.includes('partnerreport') ||
			lowerModel.includes('attachment')
		) {
			if (action === 0) return `Evidence Uploaded - ${targetName}`;
			if (action === 2) return `Evidence Deleted - ${targetName}`;
			return `Evidence Updated - ${targetName}`;
		}

		// 5. REPORTS & GENERATED REPORTS
		if (lowerModel.includes('report')) {
			if (action === 0) return `Report Generated - ${targetName}`;
			if (action === 2) return `Report Deleted - ${targetName}`;
			return `Report Updated - ${targetName}`;
		}

		// 6. USERS & PERMISSIONS / ACCESS RIGHTS
		if (
			lowerModel.includes('user') ||
			lowerModel.includes('group') ||
			lowerModel.includes('permission') ||
			lowerModel.includes('feature') ||
			lowerModel.includes('role')
		) {
			if (obj && obj.password) return `Updated Password for ${targetName || 'User'}`;
			if (
				obj &&
				(obj.platform_role ||
					obj.user_groups ||
					obj.active_features ||
					lowerModel.includes('permission') ||
					lowerModel.includes('feature'))
			) {
				return `Permissions Updated - ${targetName || 'Role Matrix'}`;
			}
			if (action === 0) return `User Created - ${targetName}`;
			if (action === 2) return `User Deleted - ${targetName}`;
			return `User Updated - ${targetName}`;
		}

		// 7. DOMAIN ASSIGNMENTS (who it was assigned to)
		if (lowerModel.includes('assignment')) {
			if (obj && (obj.reviewers || obj.spocs)) {
				const reviewers = obj.reviewers || 'None';
				const spocs = obj.spocs || 'None';
				return `Domain "${obj.domain || targetName}" assigned to Reviewer Admins: [${reviewers}], SPOC Users: [${spocs}]`;
			}
			return `Domain Assignment Updated - ${targetName}`;
		}

		// 8. FOLDERS & DOMAINS
		if (lowerModel.includes('folder') || lowerModel.includes('domain')) {
			if (action === 0) return `Folder Created - ${targetName}`;
			if (action === 2) return `Folder Deleted - ${targetName}`;
			return `Folder Updated - ${targetName}`;
		}

		// 8. GENERAL FALLBACK FOR OTHER MODELS
		const modelTitle = modelName || 'Item';
		if (action === 0) return `${modelTitle} Created - ${targetName}`;
		if (action === 2) return `${modelTitle} Deleted - ${targetName}`;

		if (obj && typeof obj === 'object') {
			const keys = Object.keys(obj).filter((k) => !['id', 'updated_at'].includes(k));
			if (keys.length === 1) {
				const k = keys[0];
				const val = Array.isArray(obj[k]) ? obj[k][1] : obj[k];
				return `Updated ${k} to "${val}"`;
			}
		}

		return `Updated ${modelTitle} - ${targetName}`;
	}
</script>

<div class="card p-4 h-full flex flex-col overflow-auto space-y-4">
	{#if data.error}
		<div class="text-error-500 p-4">{data.error}</div>
	{:else if !logsList || logsList.length === 0}
		<div class="p-4 text-surface-500">No audit logs found.</div>
	{:else}
		<div class="flex items-center justify-between px-2 text-xs font-semibold text-surface-500">
			<span>Showing top {logsList.length} of {totalCount} total audit logs</span>
		</div>
		<div class="table-container flex-1">
			<table class="table table-hover w-full">
				<thead>
					<tr>
						<th class="whitespace-nowrap">Timestamp</th>
						<th>Action</th>
						<th>User</th>
						<th>Resource Type</th>
						<th>Object</th>
						<th>Summary of Changes</th>
					</tr>
				</thead>
				<tbody>
					{#each logsList as log}
						{@const badge = getActionBadge(log)}
						<tr>
							<td class="whitespace-nowrap font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
							<td>
								<span class="badge {badge.badgeClass}">
									{badge.label}
								</span>
							</td>
							<td class="font-medium">{log.actor_email || log.actor || 'System'}</td>
							<td class="capitalize">{log.content_type_name || 'N/A'}</td>
							<td class="font-semibold text-primary-500">{log.object_repr}</td>
							<td class="text-xs max-w-md overflow-x-auto whitespace-pre-wrap py-2 font-medium">
								{formatChanges(log.changes, log.action, log.content_type_name, log.object_repr)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if logsList.length < totalCount}
			<div class="flex flex-col items-center justify-center p-4 gap-2 border-t border-surface-200-800">
				<button
					type="button"
					class="btn preset-filled-primary-500 font-medium px-6 py-2 rounded shadow-md inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
					disabled={isLoadingMore}
					onclick={loadMorePreviousLogs}
				>
					{#if isLoadingMore}
						<i class="fa-solid fa-circle-notch animate-spin"></i>
						<span>Loading Previous Logs...</span>
					{:else}
						<i class="fa-solid fa-clock-rotate-left"></i>
						<span>Load More Previous Logs</span>
					{/if}
				</button>
				<p class="text-xs text-surface-500">
					Showing top {logsList.length} of {totalCount} total audit logs
				</p>
				{#if fetchError}
					<p class="text-xs text-error-500">{fetchError}</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

