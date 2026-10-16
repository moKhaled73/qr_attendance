const studentsFileInput = document.getElementById("studentsFile");

const uploadDropzone = document.getElementById("uploadDropzone");

const selectedFileInfo = document.getElementById("selectedFileInfo");

const selectedFileName = document.getElementById("selectedFileName");

const selectedFileSize = document.getElementById("selectedFileSize");

const removeSelectedFile = document.getElementById("removeSelectedFile");

const importButton = document.getElementById("importBtn");

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} بايت`;

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function updateSelectedFile() {
  const file = studentsFileInput.files?.[0];

  if (!file) {
    selectedFileInfo.classList.add("hidden");

    selectedFileName.textContent = "";

    selectedFileSize.textContent = "";

    importButton.disabled = true;

    return;
  }

  selectedFileName.textContent = file.name;

  selectedFileSize.textContent = formatFileSize(file.size);

  selectedFileInfo.classList.remove("hidden");

  const isXlsx = /\.xlsx$/i.test(file.name);

  const withinLimit = file.size <= 5 * 1024 * 1024;

  importButton.disabled = !isXlsx || !withinLimit;

  if (!isXlsx) {
    showMessage("من فضلك اختر ملف Excel بامتداد .xlsx", true);
  } else if (!withinLimit) {
    showMessage("حجم الملف أكبر من الحد المسموح (5 MB).", true);
  }
}

studentsFileInput.addEventListener("change", updateSelectedFile);

removeSelectedFile.addEventListener("click", () => {
  studentsFileInput.value = "";

  updateSelectedFile();
});

uploadDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();

  uploadDropzone.classList.add("drag-over");
});

uploadDropzone.addEventListener("dragleave", () => {
  uploadDropzone.classList.remove("drag-over");
});

uploadDropzone.addEventListener("drop", (event) => {
  event.preventDefault();

  uploadDropzone.classList.remove("drag-over");

  const file = event.dataTransfer.files?.[0];

  if (!file) return;

  const transfer = new DataTransfer();

  transfer.items.add(file);

  studentsFileInput.files = transfer.files;

  updateSelectedFile();
});
