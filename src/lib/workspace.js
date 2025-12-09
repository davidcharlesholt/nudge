/**
 * Client-side helper to check if user has completed onboarding
 * Returns workspace data if exists, null otherwise
 */
export async function getWorkspace() {
  try {
    const res = await fetch("/api/workspace");
    const data = await res.json();
    
    if (data.ok && data.workspace) {
      return data.workspace;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching workspace");
    return null;
  }
}

/**
 * Client-side hook-like function to ensure workspace exists
 * Redirects to onboarding if no workspace found
 */
export async function requireWorkspace(router) {
  const workspace = await getWorkspace();
  
  if (!workspace) {
    router.push("/onboarding");
    return null;
  }
  
  return workspace;
}

