import React, { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";

const CHUNK_SIZE = 1024 * 1024 * 10; // 10MB

function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileIdRef = useRef(uuidv4());

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    const fileId = fileIdRef.current;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const uploadedChunks = await fetch(
      `http://<EC2_PUBLIC_IP>:4000/status?fileId=${fileId}`
    )
      .then((res) => res.json())
      .then((data) => data.uploadedChunks || []);

    for (let i = 0; i < totalChunks; i++) {
      if (uploadedChunks.includes(i.toString())) {
        setProgress(Math.floor(((i + 1) / totalChunks) * 100));
        continue;
      }

      const chunk = file.slice(
        i * CHUNK_SIZE,
        Math.min(file.size, (i + 1) * CHUNK_SIZE)
      );

      await fetch(`http://<EC2_PUBLIC_IP>:4000/upload`, {
        method: "POST",
        headers: {
          "x-file-id": fileId,
          "x-chunk-index": i.toString(),
        },
        body: chunk,
      });

      setProgress(Math.floor(((i + 1) / totalChunks) * 100));
    }

    const response = await fetch(`http://<EC2_PUBLIC_IP>:4000/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, fileName: file.name, totalChunks }),
    }).then((res) => res.json());

    setPreviewUrl(response.fileUrl);
    setUploading(false);
    alert("✅ Upload & merge complete!");
  };

  const renderPreview = () => {
    if (!previewUrl) return null;
    if (file.name.endsWith(".pdf")) {
      return (
        <iframe
          src={previewUrl}
          width="100%"
          height="500px"
          title="PDF Preview"
        />
      );
    }
    if (file.name.endsWith(".mp4")) {
      return <video controls src={previewUrl} width="100%" />;
    }
    if (file.name.endsWith(".mp3")) {
      return <audio controls src={previewUrl} />;
    }
    if (file.name.endsWith(".xlsx")) {
      return (
        <button
          onClick={async () => {
            const res = await fetch(previewUrl);
            const buffer = await res.arrayBuffer();
            const wb = XLSX.read(buffer, { type: "buffer" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_html(ws);
            document.getElementById("excel-preview").innerHTML = data;
          }}
        >
          Preview Excel
        </button>
      );
    }
    if (file.type.startsWith("image/")) {
      return <img src={previewUrl} alt="preview" width="100%" />;
    }
    return (
      <a href={previewUrl} download>
        Download File
      </a>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Large File Upload (Chunked)</h2>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files[0]);
          fileIdRef.current = uuidv4();
          setPreviewUrl(null);
        }}
      />
      <br />
      <button onClick={uploadFile} disabled={uploading}>
        {uploading ? `Uploading... ${progress}%` : "Upload"}
      </button>
      <div style={{ marginTop: 20 }}>
        {renderPreview()}
        <div id="excel-preview"></div>
      </div>
    </div>
  );
}

export default App;
