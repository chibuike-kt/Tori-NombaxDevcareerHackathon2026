export type Role = 'owner' | 'admin' | 'developer' | 'viewer';

export const can = (role: Role, action: string): boolean => {
  const permissions: Record<string, Role[]> = {
    'manage_team': ['owner'],
    'manage_plans': ['owner', 'admin'],
    'manage_subscriptions': ['owner', 'admin'],
    'manage_recovery': ['owner', 'admin'],
    'manage_payouts': ['owner'],
    'manage_payment_links': ['owner', 'admin'],
    'manage_promo_codes': ['owner', 'admin'],
    'manage_email_templates': ['owner', 'admin'],
    'manage_webhooks': ['owner', 'admin', 'developer'],
    'manage_api_keys': ['owner', 'admin', 'developer'],
    'view_webhooks': ['owner', 'admin', 'developer'],
    'view_api_keys': ['owner', 'admin', 'developer'],
    'view_all': ['owner', 'admin', 'developer', 'viewer'],
  };
  return permissions[action]?.includes(role) ?? false;
};
