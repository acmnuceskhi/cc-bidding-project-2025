import { Variants } from "framer-motion";

// Check if user prefers reduced motion
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Animation variants for page title - subtle fade in
export const titleVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: "easeInOut",
    },
  },
};

// Animation variants for sort controls - subtle fade in
export const sortControlsVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      delay: 0.2,
      ease: "easeInOut",
    },
  },
};

// Animation variants for house cards container
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.3,
    },
  },
};

// Animation variants for individual house cards - subtle fade
export const cardVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
  hover: {
    boxShadow: "0 25px 50px -12px rgba(234, 179, 8, 0.15)",
    transition: {
      duration: 0.3,
      ease: "easeInOut",
    },
  },
};

// Animation variants for team cards - subtle fade
export const teamCardVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

// Animation variants for team cards container (stagger with stacking effect)
export const teamContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

// Animation variants for team cards with stacking effect
export const stackingCardVariants: Variants = {
  hidden: { 
    opacity: 0,
    y: -10,
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
      delay: index * 0.06,
    },
  }),
};

// Animation variants for empty state
export const emptyStateVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeInOut",
    },
  },
};

// Animation variants for error state - subtle fade
export const errorVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeInOut",
    },
  },
};

// Animation variants for error exit
export const errorExitVariants: Variants = {
  visible: { opacity: 1 },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: "easeInOut",
    },
  },
};

// Animation variants for sort button feedback - minimal
export const buttonFeedbackVariants: Variants = {
  tap: {
    opacity: 0.8,
    transition: {
      duration: 0.15,
    },
  },
};
