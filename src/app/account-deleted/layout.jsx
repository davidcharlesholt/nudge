// This layout allows the account-deleted page to be viewed without authentication
// The page is shown after a user deletes their account and signs out

export default function AccountDeletedLayout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}






