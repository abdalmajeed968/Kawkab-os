interface DocRow {
  role: string;
  document: {
    id: string;
    storageKey: string;
    originalFilename: string;
    verificationStatus: string;
    uploadedAt: string | Date;
  };
}

export function DocumentList({ documents }: { documents: DocRow[] }) {
  if (documents.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--kw-text-muted)" }}>No documents on file.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Role</th>
          <th>Status</th>
          <th>Uploaded</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((d) => (
          <tr key={d.document.id}>
            <td>
              <a href={`/api/documents/file/${encodeURIComponent(d.document.storageKey)}`} target="_blank" rel="noreferrer">
                {d.document.originalFilename}
              </a>
            </td>
            <td>{d.role.replaceAll("_", " ")}</td>
            <td>{d.document.verificationStatus.replaceAll("_", " ")}</td>
            <td>{new Date(d.document.uploadedAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
