import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch(`${BASE_API_URL}/audit-logs/?limit=50&offset=0`);
		if (!res.ok) {
			return { logs: [], totalCount: 0, hasMore: false, nextOffset: 50, error: `Failed to fetch logs: ${res.statusText}` };
		}
		const data = await res.json();
		const results = data.results || (Array.isArray(data) ? data : []);
		const totalCount = data.count || results.length;
		return {
			logs: results,
			totalCount,
			hasMore: results.length < totalCount,
			nextOffset: results.length,
			error: null
		};
	} catch (e: any) {
		return { logs: [], totalCount: 0, hasMore: false, nextOffset: 50, error: e.message || 'Error fetching audit logs' };
	}
};

