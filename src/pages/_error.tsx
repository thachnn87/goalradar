// Overrides Next.js's built-in pages/_error.js which fails to prerender on
// Windows due to a duplicate-React-instance / useContext(null) issue caused
// by NTFS case-insensitive path caching in webpack. This hookless replacement
// avoids the problem while keeping 500/404 responses meaningful.
function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ padding: '4rem', textAlign: 'center', background: '#030712', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 900, color: '#fff', margin: 0 }}>
        {statusCode ?? 'Error'}
      </h1>
      <p style={{ color: '#9ca3af', marginTop: '1rem' }}>
        {statusCode === 404 ? 'Page not found.' : 'An unexpected error occurred.'}
      </p>
      <a href="/" style={{ color: '#4ade80', marginTop: '1.5rem', display: 'inline-block' }}>
        Go home
      </a>
    </div>
  );
}

ErrorPage.getInitialProps = ({
  res,
  err,
}: {
  res?: { statusCode: number };
  err?: { statusCode: number };
}) => ({ statusCode: res?.statusCode ?? err?.statusCode ?? 500 });

export default ErrorPage;
