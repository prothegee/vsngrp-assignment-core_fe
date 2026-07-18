import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/signin" },
    {
      path: "/signin",
      name: "signin",
      component: () => import("../views/SigninView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/signup",
      name: "signup",
      component: () => import("../views/SignupView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/signout",
      name: "signout",
      component: () => import("../views/SignoutView.vue"),
    },
    {
      path: "/chat",
      name: "chat",
      component: () => import("../views/ChatView.vue"),
      meta: { requiresAuth: true },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  await authStore.ensureBootstrapped();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return "/signin";
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return "/chat";
  }

  return true;
});

export default router;
