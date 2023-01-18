/* eslint-disable no-multi-spaces */
/* eslint-disable spaced-comment */
/* eslint-disable no-sequences */
/* eslint-disable one-var */
/* eslint-disable @typescript-eslint/prefer-readonly */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
const vertextSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform mat4 u_projection;
  uniform mat4 u_transform;

  void main(void) {
    gl_Position = u_projection * u_transform * vec4(a_position, 0, 1);
    v_texCoord = a_texCoord;
  }
`

const textFragSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float alpha;

  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    gl_FragColor = vec4(color.r, color.g, color.b, color.a * alpha);
  }
`

export default class WebGL {
  readonly context: WebGLRenderingContext

  private restoreInfo: {
    program: WebGLProgram | null
    transformMat: number[]
    globalAlpha: number
  } = {
    program: null,
    globalAlpha: 1.0,
    transformMat: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]
  }

  readonly textCoord = [
    0.0, 1.0,
    1.0, 1.0,
    0.0, 0.0,
    1.0, 0.0
  ]

  private transformMat = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]

  readonly pictureProgram: WebGLProgram | null = null

  public globalAlpha = 1.0

  private projMat: number[]

  constructor (ctx: WebGLRenderingContext) {
    if (ctx === null) throw new Error('Render Context cannot be null')
    this.context = ctx
    this.projMat = this.createProjectionMat(0, ctx.canvas.width, 0, ctx.canvas.height)
    ctx.enable(ctx.BLEND)
    ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA)

    const vertexShader = this.createShader(ctx.VERTEX_SHADER, vertextSource)
    const picFragShader = this.createShader(ctx.FRAGMENT_SHADER, textFragSource)
    if (vertexShader && picFragShader) this.pictureProgram = this.createProgram([vertexShader, picFragShader])
  }

  createProjectionMat (left: number, right: number, top: number, bottom: number): number[] { // 坐标变换矩阵
    return [
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, 2, 0,
      -(right + left) / (right - left), -(top + bottom) / (top - bottom), -1, 1
    ]
  }

  transposeMatrix (mat: number[]): number[] {
    return [
      mat[0], mat[4], mat[8], mat[12],
      mat[1], mat[5], mat[9], mat[13],
      mat[2], mat[6], mat[10], mat[14],
      mat[3], mat[7], mat[11], mat[15]
    ]
  }

  matrixMultiply (a: number[], b: number[]): number[] {
    return [
      a[0]  * b[0] + a[1]  * b[4]  + a[2]  * b[8]  + a[3]  * b[12], //0,0
      a[0]  * b[1] + a[1]  * b[5]  + a[2]  * b[9]  + a[3]  * b[13], //0,1
      a[0]  * b[2] + a[1]  * b[6]  + a[2]  * b[10] + a[3]  * b[14], //0,2
      a[0]  * b[3] + a[1]  * b[7]  + a[2]  * b[11] + a[3]  * b[15], //0,3
      a[4]  * b[0] + a[5]  * b[4]  + a[6]  * b[8]  + a[7]  * b[12], //1,0
      a[4]  * b[1] + a[5]  * b[5]  + a[6]  * b[9]  + a[7]  * b[13], //1,1
      a[4]  * b[2] + a[5]  * b[6]  + a[6]  * b[10] + a[7]  * b[14], //1,2
      a[4]  * b[3] + a[5]  * b[7]  + a[6]  * b[11] + a[7]  * b[15], //1,3
      a[8]  * b[0] + a[9]  * b[4]  + a[10] * b[8]  + a[11] * b[12], //2,0
      a[8]  * b[1] + a[9]  * b[5]  + a[10] * b[9]  + a[11] * b[13], //2,1
      a[8]  * b[2] + a[9]  * b[6] + a[10] * b[10] + a[11] * b[14], //2,2
      a[8]  * b[3] + a[9]  * b[7] + a[10] * b[11] + a[11] * b[15], //2,3
      a[12] * b[0] + a[13] * b[4]  + a[14] * b[8]  + a[15] * b[12], //3,0
      a[12] * b[1] + a[13] * b[5]  + a[14] * b[9]  + a[15] * b[13], //3,1
      a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + a[15] * b[14], //3,2
      a[12] * b[3] + a[13] * b[7] + a[14] * b[11] + a[15] * b[15] //3,3
    ]
  }

  invertMatrix (mat: number[]): number[] {
    const te = [...mat]

    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3],
      n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7],
      n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11],
      n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15],

      t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
      t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
      t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
      t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14

    if (det === 0) return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    const detInv = 1 / det

    te[0] = t11 * detInv
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv

    te[4] = t12 * detInv
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv

    te[8] = t13 * detInv
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv

    te[12] = t14 * detInv
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv

    return te
  }

  createShader (
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = this.context.createShader(type)
    if (shader === null) return null
    this.context.shaderSource(shader, source)
    this.context.compileShader(shader)

    if (this.context.getShaderParameter(shader, this.context.COMPILE_STATUS) === false) {
      console.error(
        'a error occured compiling shader',
        this.context.getShaderInfoLog(shader)
      )
      return null
    }

    return shader
  }

  createProgram (shaders: WebGLShader[]): WebGLProgram | null {
    const program = this.context.createProgram()
    if (program === null) return null
    shaders.forEach((shader) => this.context.attachShader(program, shader))
    this.context.linkProgram(program)

    if (this.context.getProgramParameter(program, this.context.LINK_STATUS) === false) {
      console.error(
        'a error occured linking program ',
        this.context.getProgramInfoLog(program)
      )
      return null
    }

    return program
  }

  save (program?: WebGLProgram): void {
    if (program !== undefined) this.context.useProgram(program)
    this.restoreInfo.globalAlpha = this.globalAlpha
    this.restoreInfo.transformMat = this.transformMat
  }

  restore (): void {
    if (this.restoreInfo.program !== undefined) {
      this.context.useProgram(this.restoreInfo.program)
    }
    this.transformMat = this.restoreInfo.transformMat
    this.globalAlpha = this.restoreInfo.globalAlpha
  }

  transform (a: number, b: number, c: number, d: number, e: number, f: number): void {
    const mat = [
      a, b, 0, 0,
      c, d, 0, 0,
      0, 0, 1, 0,
      e, f, 0, 1
    ]
    this.transformMat = this.matrixMultiply(mat, this.transformMat)
    // this.transformMat[0] = a ?? 1
    // this.transformMat[1] = b ?? 0
    // this.transformMat[4] = c ?? 0
    // this.transformMat[5] = d ?? 1
    // this.transformMat[12] = e ?? 0
    // this.transformMat[13] = f ?? 0
  }

  setAttribute (program: WebGLProgram, attribute: string, data: number[]): void {
    const buffer = this.context.createBuffer()
    this.context.bindBuffer(this.context.ARRAY_BUFFER, buffer)
    this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array(data), this.context.STATIC_DRAW)
    const aVertexPositionLocation = this.context.getAttribLocation(program, attribute)
    this.context.enableVertexAttribArray(aVertexPositionLocation)
    this.context.vertexAttribPointer(aVertexPositionLocation, 2, this.context.FLOAT, false, 0, 0)
  }

  clear (r?: number, g?: number, b?: number, a?: number): void {
    this.context.clearColor(r ?? 0, g ?? 0, b ?? 0, a ?? 0)
    this.context.clear(this.context.COLOR_BUFFER_BIT)
  }

  drawImage (img: any, dx: number, dy: number, dWidth: number, dHeight: number): void {
    if (this.pictureProgram === null) return
    this.context.useProgram(this.pictureProgram)
    // left, bottom,
    // right, bottom,
    // left, top,
    // right, top
    const posArr = [dx, dHeight, dWidth, dHeight, dx, dy, dWidth, dy]
    this.setAttribute(this.pictureProgram, 'a_position', posArr)

    this.setAttribute(this.pictureProgram, 'a_texCoord', this.textCoord)

    const projection = this.context.getUniformLocation(this.pictureProgram, 'u_projection')
    this.context.uniformMatrix4fv(projection, false, this.projMat)

    const transform = this.context.getUniformLocation(this.pictureProgram, 'u_transform')
    // const testTransform = this.transposeMatrix(this.invertMatrix(this.transposeMatrix(this.transformMat)))
    // console.log(this.transformMat, testTransform)
    this.context.uniformMatrix4fv(transform, false, this.transformMat)

    const alpha = this.context.getUniformLocation(this.pictureProgram, 'alpha')
    this.context.uniform1f(alpha, this.globalAlpha)

    const texture = this.context.createTexture()
    this.context.bindTexture(this.context.TEXTURE_2D, texture)
    const sampler = this.context.getUniformLocation(this.pictureProgram, 'u_image')
    this.context.uniform1i(sampler, 0)

    this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_S, this.context.CLAMP_TO_EDGE)
    this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_WRAP_T, this.context.CLAMP_TO_EDGE)
    this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MIN_FILTER, this.context.LINEAR)
    this.context.texParameteri(this.context.TEXTURE_2D, this.context.TEXTURE_MAG_FILTER, this.context.LINEAR)
    this.context.texImage2D(this.context.TEXTURE_2D, 0, this.context.RGBA, this.context.RGBA, this.context.UNSIGNED_BYTE, img)

    this.context.drawArrays(this.context.TRIANGLE_STRIP, 0, 4)
  }
}
