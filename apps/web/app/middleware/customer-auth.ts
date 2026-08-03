export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;
  const { customer, restore } = useCustomerSession();
  await restore();
  if (!customer.value) return navigateTo('/login');
});
