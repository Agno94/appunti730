export function readTextFile(file){
  return new Promise((resolve, reject) => {
    var fr = new FileReader()
    fr.onload = () => {
      resolve(fr.result)
    };
    fr.onerror = reject
    fr.readAsText(file)
  });
}

export function readBinaryFile(file){
  return new Promise((resolve, reject) => {
    var fr = new FileReader()
    fr.onload = () => {
      resolve(fr.result)
    };
    fr.onerror = reject
    fr.readAsArrayBuffer(file)
  });
}
