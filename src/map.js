import * as THREE from "three";
import {createDoor} from "./door.js";

export const districts = [
  {
    id: "london", name: "伦敦", english: "London", title: "雾中的伦敦",
    description: "从凯里家的卧室走到昂斯洛花园，菲利普在两所房子里学会了告别。",
    atmosphere: "street", surface: "stone", sky: 0x9ba9a8, ground: 0x5c5d57, spawn: [0, 12],
    sites: [
      {name: "凯里家的房子", chapters: [1, 3], kind: "town", x: -9, z: -12, width: 8.2, depth: 6.6, height: 7, stone: 0x796b60},
      {name: "沃特金小姐家", chapters: [2], kind: "town", x: 9, z: -12, width: 9, depth: 6.6, height: 7.7, stone: 0x969083}
    ]
  },
  {
    id: "blackstable", name: "布莱克斯泰布尔", english: "Blackstable", title: "布莱克斯泰布尔",
    description: "牧师住宅、花园和教堂沿镇上的碎石路排列。第 14 章的祷告让菲利普回到这里。",
    atmosphere: "country", surface: "gravel", sky: 0xa6aea0, ground: 0x69724b, spawn: [0, 13],
    sites: [
      {name: "牧师住宅与花园", chapters: [4, 5, 6, 8, 9, 14], kind: "rectory", x: -9.5, z: -10, width: 11.5, depth: 7.4, height: 5.8, stone: 0x8b8473},
      {name: "布莱克斯泰布尔教堂", chapters: [7], kind: "church", x: 9.8, z: -11.5, width: 8.6, depth: 9, height: 6.4, stone: 0x8d8c77}
    ]
  },
  {
    id: "tercanbury", name: "特坎伯里", english: "Tercanbury", title: "特坎伯里的校园",
    description: "从预备学校宿舍穿过院落，去往国王学校书房与大教堂。",
    atmosphere: "yard", surface: "stone", sky: 0x98a6a9, ground: 0x64675a, spawn: [0, 15],
    sites: [
      {name: "预备学校与宿舍", chapters: [10, 11, 12, 13], kind: "school", x: -14.9, z: -11.5, width: 11.5, depth: 7.4, height: 7.15, stone: 0x8a7061},
      {name: "国王学校与自习室", chapters: [15, 16, 18, 19, 20, 21], kind: "school", x: 0, z: -16, width: 10.3, depth: 8, height: 7.7, stone: 0x92836c},
      {name: "特坎伯里大教堂", chapters: [17], kind: "church", x: 15.1, z: -11, width: 9.8, depth: 10.4, height: 9.2, stone: 0x9e9b8d}
    ]
  }
];

export function locationForChapter(chapter) {
  const districtIndex = districts.findIndex(({sites}) => sites.some(({chapters}) => chapters.includes(chapter)));
  const area = districts[Math.max(districtIndex, 0)];
  return [area, Math.max(0, area.sites.findIndex(({chapters}) => chapters.includes(chapter)))];
}

export function siteEntrance(site) {
  return {x: site.x, z: site.z + site.depth / 2 + .55, marker: 1.85, obstacle: 0};
}

const bounds = {minX: -31, maxX: 31, minZ: -26.8, maxZ: 22.6};
const roofColor = 0x454d4b;
const seed = (id) => ((id * 47 + 13) % 97) / 96;

function touchesBuilding(start, end, obstacle) {
  let enter = 0;
  let exit = 1;
  for (const [axis, extent] of [["x", obstacle.w], ["z", obstacle.d]]) {
    const change = end[axis] - start[axis];
    const minimum = obstacle[axis] - extent / 2 - .22;
    const maximum = obstacle[axis] + extent / 2 + .22;
    if (Math.abs(change) < .0001) {
      if (start[axis] < minimum || start[axis] > maximum) return false;
      continue;
    }
    const first = (minimum - start[axis]) / change;
    const last = (maximum - start[axis]) / change;
    enter = Math.max(enter, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
    if (enter > exit) return false;
  }
  return true;
}

function routeAroundBuildings(start, end, obstacles) {
  const clear = (from, to) => !obstacles.some((obstacle) => touchesBuilding(from, to, obstacle));
  if (clear(start, end)) return [];
  const nodes = [start, end];
  for (const {x,z,w,d} of obstacles) {
    for (const dx of [-w / 2 - .42, w / 2 + .42]) {
      for (const dz of [-d / 2 - .42, d / 2 + .42]) {
        const point = {x: x + dx, z: z + dz};
        const offMap = point.x < bounds.minX || point.x > bounds.maxX || point.z < bounds.minZ || point.z > bounds.maxZ;
        if (!offMap && clear(point, point)) nodes.push(point);
      }
    }
  }
  const distances = nodes.map(() => Infinity);
  const parents = nodes.map(() => -1);
  const pending = new Set(nodes.keys());
  distances[0] = 0;
  while (pending.size) {
    let closest = -1;
    for (const candidate of pending) {
      if (distances[candidate] < (distances[closest] ?? Infinity)) closest = candidate;
    }
    if (closest < 0 || closest === 1) break;
    pending.delete(closest);
    const current = nodes[closest];
    for (const candidate of pending) {
      const next = nodes[candidate];
      const distance = distances[closest] + Math.hypot(next.x - current.x, next.z - current.z);
      if (distance < distances[candidate] && clear(current, next)) {
        distances[candidate] = distance;
        parents[candidate] = closest;
      }
    }
  }
  if (parents[1] < 0) return null;
  const route = [];
  for (let index = parents[1]; index > 0; index = parents[index]) route.unshift(nodes[index]);
  return route;
}

export function buildDistrict(scene, area, {box, group, cylinder, shape}) {
  const root = group(scene);
  const obstacles = [];
  const doors = [];
  const block = (x, z, w, d) => obstacles.push({x, z, w, d});
  box(root, area.ground, 86, .35, 78, 0, -.22, -3);
  scene.background = new THREE.Color(area.sky);
  scene.fog = new THREE.FogExp2(area.sky, .015);

  const skylight = new THREE.HemisphereLight(0xf5e5c8, 0x5d6451, 2.4);
  const sunlight = new THREE.DirectionalLight(0xf5d5ad, 2.02);
  sunlight.position.set(-13, 19, 9);
  scene.add(skylight, sunlight);

  function windowWall(parent, x, y, z, width, height, arch) {
    box(parent, 0x55534a, width + .15, height + .10, .12, x, y, z);
    box(parent, arch ? 0x9b805e : 0x90806a, width, height, .10, x, y, z + .058);
    const glass = box(parent, arch ? 0x5b7380 : 0x685f50, width - .18, height - .16, .039, x, y, z + .126);
    glass.material.emissive.setHex(arch ? 0x744627 : 0x895023);
    glass.material.emissiveIntensity = arch ? .5 : .28;
    box(parent, 0x322e2b, .068, height - .11, .053, x, y, z + .153);
    box(parent, 0x322e2b, width - .10, .072, .054, x, y - height * .075, z + .152);
    box(parent, 0xb1a38a, width + .32, .09, .30, x, y - height / 2 - .06, z + .09);
    if (arch) {
      const top = shape(parent, new THREE.ConeGeometry(width * .60, width * .53, 3), 0x817b6d, x, y + height / 2 + .21, z + .06);
      top.rotation.y = Math.PI / 3;
      top.scale.z = .28;
    }
  }

  function roof(parent, w, d, y, rise, color = roofColor) {
    const slope = Math.atan2(rise, w / 2);
    const width = Math.hypot(w / 2, rise) + .39;
    for (const side of [-1, 1]) {
      const tile = box(parent, color, width, .24, d + .55, side * w / 4, y + rise / 2, 0);
      tile.rotation.z = -side * slope;
    }
    const profile = new THREE.Shape();
    profile.moveTo(-w / 2, 0);
    profile.lineTo(w / 2, 0);
    profile.lineTo(0, rise);
    profile.closePath();
    shape(parent, new THREE.ExtrudeGeometry(profile, {depth: d, bevelEnabled: false}), color, 0, y - .02, -d / 2);
    box(parent, 0x3c4540, .17, .18, d + .6, 0, y + rise + .06, 0);
  }

  function entry(parent, z, stone, width, top, playable) {
    if (playable) {
      doors.push(createDoor(parent, {box, group, cylinder, shape}, {x: 0, z, width, height: top, color: 0x554035, casing: 0x918571}));
    } else {
      box(parent, 0xa29983, width + .48, top + .24, .20, 0, (top + .24) / 2, z);
      box(parent, 0x423930, width, top, .21, 0, top / 2, z + .09);
      for (const y of [.54, top - .54]) box(parent, 0x635243, width - .26, .61, .05, 0, y, z + .217);
      box(parent, 0xaa8550, .085, .09, .055, width * .32, 1.10, z + .242);
    }
    box(parent, stone, width + .68, .11, .59, 0, .055, z + .37);
    box(parent, 0xe6c587, .15, .22, .11, -width * .67, top - .37, z + .25).material.emissive.setHex(0x956531);
  }

  function building(site, detailed = true, playable = false) {
    const {x, z, width:w, depth:d, height:h, stone:color, kind} = site;
    const base = group(root, x, 0, z);
    const tower = kind === "church";
    const face = d / 2 + .018;
    const wide = tower || kind === "school";
    const entryWidth = wide ? 1.80 : 1.26;
    const entryHeight = wide ? 2.79 : 2.28;
    const sideWidth = (w - entryWidth - .22) / 2;
    const wallX = w / 2 - sideWidth / 2;
    if (playable) {
      const foyerDepth = 2.75;
      const foyerRear = face - foyerDepth;
      for (const side of [-1, 1]) {
        box(base, color, sideWidth, h, d, side * wallX, h / 2, 0);
        block(x + side * wallX, z, sideWidth, d + .08);
      }
      box(base, color, entryWidth + .22, h - entryHeight, d, 0, (h + entryHeight) / 2, 0);
      const backDepth = d - foyerDepth;
      box(base, 0x706253, entryWidth + .24, entryHeight, backDepth, 0, entryHeight / 2, -foyerDepth / 2);
      block(x, z - foyerDepth / 2, entryWidth + .25, backDepth);
      box(base, 0x615345, entryWidth + .28, .065, foyerDepth, 0, -.012, face - foyerDepth / 2);
      box(base, 0x97806a, entryWidth + .23, .07, .12, 0, .17, foyerRear + .08);
      const sconce = box(base, 0xe2b477, .15, .21, .12, 0, entryHeight * .78, foyerRear + .08);
      sconce.material.emissive.setHex(0xa86622);
    } else {
      box(base, color, w, h, d, 0, h / 2, 0);
      block(x, z, w + .12, d + .12);
    }
    const rise = tower ? 2.2 : 1.45;
    roof(base, w, d, h, rise, kind === "town" ? 0x4f5356 : roofColor);
    if (playable) {
      for (const side of [-1, 1]) box(base, 0x6f6c63, sideWidth, .23, .21, side * wallX, .20, face);
    } else box(base, 0x6f6c63, w + .19, .23, .21, 0, .20, face);
    box(base, 0xada18b, w + .20, .19, .21, 0, h - .31, face);
    if (!detailed) return;
    entry(base, face, color, entryWidth, entryHeight, playable);
    for (const x of [-1, 1]) {
      const inset = x * w * .31;
      windowWall(base, inset, 1.95, face, tower ? 1.36 : 1.20, tower ? 2.64 : 1.52, tower);
      windowWall(base, inset, h - 1.72, face, tower ? 1.01 : 1.15, tower ? 1.65 : 1.45, tower);
      if (w > 8 && !tower) {
        windowWall(base, x * w * .131, h - 1.72, face, .90, 1.37, false);
      }
      if (tower || kind === "school") {
        box(base, 0x766d5e, .50, h * .84, .56, x * (w / 2 - .39), h * .42, face + .14);
        box(base, 0x938a78, .60, .31, .67, x * (w / 2 - .39), h * .82, face + .15);
      } else {
        const chimney = box(base, 0x756155, .88, 2.65, .74, x * w * .29, h + .40, -d * .27);
        chimney.castShadow = false;
        box(base, 0x504b46, .97, .19, .86, x * w * .29, h + 1.73, -d * .27);
      }
    }
    if (tower) {
      const size = Math.min(3.52, w / 2);
      const top = h + 4.0;
      const tz = -d * .22;
      box(base, 0x8c8879, size, 4.36, size, 0, h + 1.90, tz);
      windowWall(base, 0, h + 2.4, tz + size / 2, .93, 1.65, true);
      box(base, 0x6e6b60, size + .22, .20, size + .22, 0, top, tz);
      for (const side of [-1, 1]) {
        for (const offset of [-1, 0, 1]) {
          box(base, color, .43, .52, .45, offset * size * .37, top + .35, tz + side * size * .46);
        }
      }
      const portal = shape(base, new THREE.ConeGeometry(1.40, .87, 3), 0xb0a895, 0, 3.38, face + .04);
      portal.rotation.y = Math.PI / 3;
      portal.scale.z = .16;
      const rose = cylinder(base, 0x8a7d69, .80, .80, .13, 0, 5.25, face + .04, 14);
      rose.rotation.x = Math.PI / 2;
      const center = cylinder(base, 0x736e68, .63, .63, .13, 0, 5.25, face + .10, 14);
      center.rotation.x = Math.PI / 2;
      for (let index = 0; index < 4; index++) {
        const tracery = box(base, 0xaf9d79, .053, 1.18, .049, 0, 5.25, face + .18);
        tracery.rotation.z = index * Math.PI / 4;
      }
    } else if (kind === "school") {
      windowWall(base, 0, h - 1.73, face, 1.44, 1.72, true);
    } else {
      box(base, 0x9a8f7f, w + .10, .09, .14, 0, 3.48, face + .022);
    }
  }

  function trees(points) {
    for (const [x, z, size] of points) {
      cylinder(root, 0x64513d, .12 * size, .21 * size, 3.15 * size, x, size * 1.56, z, 8);
      for (let index = 0; index < 4; index++) {
        const leaf = shape(root, new THREE.IcosahedronGeometry(1, 1), [0x596445,0x686d4d,0x46563c,0x737454][index],
          x + (seed(index + 2) - .5) * size * 2.5, size * (3.1 + index * .43), z + (index % 2 - .5) * size);
        leaf.scale.set(size * 1.06, size * 1.36, size * 1.23);
      }
      block(x, z, .45 * size, .45 * size);
    }
  }

  function stonePath(x, z, width, length, gravel = false) {
    const color = gravel ? 0x98917b : 0x7d796f;
    box(root, color, width, .027, length, x, -.011, z);
    const step = gravel ? .62 : .74;
    const columns = Math.floor(width / step);
    const rows = Math.floor(length / step);
    const pieces = new THREE.InstancedMesh(new THREE.BoxGeometry(step - .032, .028, step - .040),
      new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .95}), columns * rows);
    const transform = new THREE.Object3D();
    for (let index = 0; index < rows * columns; index++) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      transform.position.set(x + (col - (columns - 1) / 2) * step + (row % 2) * .045,
        .008 + seed(index) * .008, z + (row - (rows - 1) / 2) * step);
      transform.updateMatrix();
      pieces.setMatrixAt(index, transform.matrix);
      pieces.setColorAt(index, new THREE.Color(color).multiplyScalar(.82 + seed(index + 1) * .24));
    }
    root.add(pieces);
  }

  function lamps(points) {
    for (const [x, z] of points) {
      cylinder(root, 0x454741, .060, .106, 2.61, x, 1.31, z, 10);
      cylinder(root, 0x454741, .16, .08, .18, x, 2.65, z, 6);
      const glass = box(root, 0xe2ba78, .31, .37, .31, x, 2.92, z);
      glass.material.emissive.setHex(0xcb8636);
      glass.material.emissiveIntensity = 1.05;
      cylinder(root, 0x44433c, .10, .25, .22, x, 3.20, z, 6);
      block(x, z, .35, .35);
    }
  }

  if (area.id === "london") {
    stonePath(0, 3, 33, 37);
    box(root, 0x565851, 71, .076, 8.4, 0, .036, 7.5);
    for (const side of [-1, 1]) {
      box(root, 0x8f9289, 67, .091, .23, 0, .049, 7.5 + side * 4.26);
      for (let index = 0; index < 3; index++) {
        building({x: side * (18.1 + index * 8.4), z: -13.6, width: 7.4, depth: 6.5, height: 6.23 + seed(index + side + 2), stone: 0x716d64, kind: "town"}, index < 2);
      }
    }
    lamps([[-13.7,-2], [13.8,-2], [-3.5,3.0], [14.3,13]]);
    trees([[-25,1,1], [25,1,1.07]]);
  } else if (area.id === "blackstable") {
    stonePath(0, 2, 33, 12, true);
    stonePath(0, 10, 3.9, 23, true);
    trees([[-26,-8,1.8],[-20,-14,1.22],[-16,7,1.25],[19,-10,1.4],[23,3,1.84],[20,13,1.02],[-7,-25,1.68],[17,-20,1.31]]);
    for (const x of [-20.5,20.5]) {
      for (let index = 0; index < 7; index++) {
        const z = -5.4 + index * 2.05;
        const hedge = shape(root, new THREE.IcosahedronGeometry(.89, 0), 0x4f603f, x, .69, z);
        hedge.scale.set(1.13, .96, 1.43);
        block(x, z, 1.5, 1.86);
      }
    }
    building({x:-23,z:-18,width:6.0,depth:5.1,height:4.0,stone:0x8b826c,kind:"rectory"});
    building({x:25,z:-19,width:6.2,depth:5.0,height:3.75,stone:0xa2977a,kind:"rectory"});
    lamps([[-4.45,-3.3], [4.7,-3.8], [4.7,11.3]]);
  } else {
    stonePath(0, 1.6, 37, 19);
    stonePath(0, 12.1, 5.7, 16.0);
    for (const side of [-1, 1]) {
      box(root, 0x746f61, .55, 2.21, 25, side * 24, 1.07, -4.9);
      box(root, 0xa09882, .83, .13, 25, side * 24, 2.21, -4.9);
      block(side * 24, -4.9, .53, 25);
      box(root, 0x888171, 15.0, 2.25, .48, side * 12, 1.09, 18.7);
      box(root, 0x544f44, 15.1, .16, .68, side * 12, 2.26, 18.7);
      block(side * 12,18.7,15,.48);
    }
    trees([[-22,-12,1.28],[-23,9,1.05],[22,-9,1.44],[21,8,1.2],[9,-23,1.44],[-12,-24,1.5]]);
    lamps([[-7,7.7],[7,7.7],[-19,-2],[19,-2]]);
  }
  for (const site of area.sites) building(site, true, true);
  return {
    root, obstacles, bounds, doors, surface: area.surface, markers: area.sites.map(siteEntrance),
    passage: (from, to) => routeAroundBuildings(from, to, obstacles)
  };
}

export function drawDistrictPlan(canvas, area, selected, position) {
  const ctx = canvas.getContext("2d");
  const {width, height} = canvas;
  const x = (value) => width / 2 + value * 4.45;
  const z = (value) => height / 2 + value * 3.42;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e8e0ce";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = area.id === "blackstable" ? "#cacbb0" : "#d6cebb";
  ctx.fillRect(x(-23), z(-21), x(23) - x(-23), z(17) - z(-21));
  ctx.strokeStyle = "#a99c82";
  ctx.lineWidth = 1;
  ctx.strokeRect(x(-23), z(-21), x(23) - x(-23), z(17) - z(-21));
  ctx.strokeStyle = "#f4ebd7";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x(-22), z(1));
  ctx.lineTo(x(22), z(1));
  ctx.moveTo(x(0), z(-11));
  ctx.lineTo(x(0), z(18));
  ctx.stroke();
  area.sites.forEach((site, index) => {
    const gate = siteEntrance(site);
    ctx.fillStyle = index === selected ? "#83472f" : "#6c6b58";
    ctx.fillRect(x(site.x - site.width / 2), z(site.z - site.depth / 2), site.width * 4.45, site.depth * 3.42);
    ctx.beginPath();
    ctx.arc(x(gate.x), z(gate.z + 2.4), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6e8";
    ctx.font = "10px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(index + 1, x(gate.x), z(gate.z + 2.4));
  });
  if (position) {
    ctx.fillStyle = "#384d39";
    ctx.strokeStyle = "#f5edef";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x(position.x), z(position.z), 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
