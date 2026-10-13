/** Shared print treatment: black shadows, burnt-orange midtones, ivory highlights. */
export default function ImageTone() {
  return <>
    <feColorMatrix type="saturate" values="0" />
    <feComponentTransfer>
      <feFuncR type="table" tableValues="0.063 0.835 0.902" />
      <feFuncG type="table" tableValues="0.063 0.212 0.835" />
      <feFuncB type="table" tableValues="0.063 0.047 0.741" />
    </feComponentTransfer>
  </>
}
