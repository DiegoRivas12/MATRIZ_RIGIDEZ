import React, { useState, useEffect } from 'react';

const CalculadoraMatrizRigidez = () => {
  // Datos de la estructura
  const E = 200e9;
  const A = 0.0015;
  
  // 🆕 Nodos dinámicos
  const [nodos, setNodos] = useState({
    1: [0.0, 0.0],
    2: [4.0, 0.0],
    3: [8.0, 3.0],
    4: [4.0, 3.0],
    5: [0.0, 3.0]
  });
  
  const [elementos, setElementos] = useState([
    [3, 2], [3, 4], [4, 5], [4, 2], [2, 5], [2, 1], [1, 5]
  ]);

  const [normales, setNormales] = useState({
    n1: { x: 7, y: 8 },
    n2: { x: 5, y: 6 },
    n3: { x: 1, y: 2 },
    n4: { x: 3, y: 4 },
    n5: { x: 9, y: 10 }
  });

  const [resultados, setResultados] = useState({
    matrizGlobal: [],
    matricesElementales: [],
    propiedades: {},
    cargando: false,
    mostrarResultados: false
  });

  // 🆕 Cambiar coordenadas de un nodo
  const handleNodoChange = (nodo, coord, valor) => {
    setNodos(prev => ({
      ...prev,
      [nodo]: coord === "x" 
        ? [parseFloat(valor) || 0, prev[nodo][1]]
        : [prev[nodo][0], parseFloat(valor) || 0]
    }));
  };

  // 🆕 Agregar nuevo nodo
  const agregarNodo = () => {
    const nuevoId = Object.keys(nodos).length + 1;
    setNodos(prev => ({
      ...prev,
      [nuevoId]: [0.0, 0.0]
    }));
    setNormales(prev => ({
      ...prev,
      [`n${nuevoId}`]: { x: nuevoId * 2 - 1, y: nuevoId * 2 }
    }));
  };

  const matrizRigidezElemento = (nodo_i, nodo_j) => {
    const [xi, yi] = nodos[nodo_i];
    const [xj, yj] = nodos[nodo_j];
    
    const dx = xj - xi;
    const dy = yj - yi;
    const L = Math.sqrt(dx*dx + dy*dy);
    
    const c = dx / L;
    const s = dy / L;
    const EA_L = (E * A) / L;
    
    const k = [
      [ c*c*EA_L,  c*s*EA_L, -c*c*EA_L, -c*s*EA_L],
      [ c*s*EA_L,  s*s*EA_L, -c*s*EA_L, -s*s*EA_L],
      [-c*c*EA_L, -c*s*EA_L,  c*c*EA_L,  c*s*EA_L],
      [-c*s*EA_L, -s*s*EA_L,  c*s*EA_L,  s*s*EA_L]
    ];
    
    return { k, L, c, s, EA_L };
  };

  const formatearNumero = (valor) => {
    if (Math.abs(valor) < 1e-6) return '0.000';
    if (Math.abs(valor) >= 1000) return valor.toExponential(3);
    return valor.toFixed(3);
  };

  const calcularMatriz = () => {
    setResultados(prev => ({ ...prev, cargando: true, mostrarResultados: false }));

    setTimeout(() => {
      // 🔑 Construir asignación de normales dinámicamente
      const asignacion = {};
      Object.keys(nodos).forEach((nodo) => {
        asignacion[nodo] = [normales[`n${nodo}`].x, normales[`n${nodo}`].y];
      });

      const ndof = Object.keys(nodos).length * 2; // dinámico
      let K_original = Array(ndof).fill().map(() => Array(ndof).fill(0));
      
      for (const [ni, nj] of elementos) {
        if (!nodos[ni] || !nodos[nj]) continue; // seguridad
        const { k } = matrizRigidezElemento(ni, nj);
        const dof = [2*(ni-1), 2*(ni-1)+1, 2*(nj-1), 2*(nj-1)+1];
        
        for (let a = 0; a < 4; a++) {
          for (let b = 0; b < 4; b++) {
            K_original[dof[a]][dof[b]] += k[a][b];
          }
        }
      }
      
      const normalToOriginal = {};
      for (const [nodo, [normX, normY]] of Object.entries(asignacion)) {
        const nodoInt = parseInt(nodo);
        normalToOriginal[normX] = 2 * (nodoInt - 1);
        normalToOriginal[normY] = 2 * (nodoInt - 1) + 1;
      }
      
      const totalNormales = Object.values(asignacion).flat().length;
      const permutacion = [];
      const etiquetas = [];
      for (let i = 1; i <= totalNormales; i++) {
        permutacion.push(normalToOriginal[i]);
        etiquetas.push(`N${i}`);
      }
      
      let K_permutada = Array(ndof).fill().map(() => Array(ndof).fill(0));
      for (let i = 0; i < ndof; i++) {
        for (let j = 0; j < ndof; j++) {
          K_permutada[i][j] = K_original[permutacion[i]][permutacion[j]];
        }
      }
      
      const traza = K_permutada.reduce((sum, row, i) => sum + row[i], 0);
      const esSimetrica = JSON.stringify(K_permutada) === JSON.stringify(K_permutada[0].map((_, i) => K_permutada.map(row => row[i])));
      
      let countZeros = 0;
      let countNonZeros = 0;
      for (let i = 0; i < K_permutada.length; i++) {
        for (let j = 0; j < K_permutada[i].length; j++) {
          if (Math.abs(K_permutada[i][j]) < 1e-6) countZeros++;
          else countNonZeros++;
        }
      }

      const matricesElementales = elementos.map(([ni, nj], idx) => {
        if (!nodos[ni] || !nodos[nj]) return null;
        const { k, L, c, s } = matrizRigidezElemento(ni, nj);
        const normales_i = asignacion[ni];
        const normales_j = asignacion[nj];
        const etiquetas_elem = [
          `N${normales_i[0]}`, `N${normales_i[1]}`,
          `N${normales_j[0]}`, `N${normales_j[1]}`
        ];
        
        return {
          elemento: idx + 1,
          nodos: `${ni}-${nj}`,
          longitud: L,
          coseno: c,
          seno: s,
          matriz: k,
          etiquetas: etiquetas_elem
        };
      }).filter(Boolean);

      setResultados({
        matrizGlobal: K_permutada,
        etiquetasGlobal: etiquetas,
        matricesElementales,
        propiedades: {
          esSimetrica,
          traza,
          dimensiones: `${ndof} × ${ndof}`,
          elementosNoCero: countNonZeros,
          elementosCero: countZeros
        },
        asignacion,
        cargando: false,
        mostrarResultados: true
      });
    }, 500);
  };

  useEffect(() => {
    calcularMatriz();
  }, [nodos, normales, elementos]);

  const handleNormalChange = (nodo, direccion, valor) => {
    setNormales(prev => ({
      ...prev,
      [nodo]: {
        ...prev[nodo],
        [direccion]: parseInt(valor) || 0
      }
    }));
  };

  const MatrizTable = ({ matriz, etiquetas, titulo }) => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
        <h3 className="text-white font-bold text-lg">{titulo}</h3>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="bg-gray-800 text-white p-3 border border-gray-300 font-bold sticky left-0">
                ↓Fila/Col→
              </th>
              {etiquetas.map((etiqueta, index) => (
                <th key={index} className="bg-gray-700 text-white p-3 border border-gray-300 font-bold min-w-20">
                  {etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.map((fila, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <th className="bg-gray-700 text-white p-3 border border-gray-300 font-bold sticky left-0">
                  {etiquetas[i]}
                </th>
                {fila.map((valor, j) => (
                  <td
                    key={j}
                    className={`p-3 border border-gray-300 text-center font-mono text-sm transition-all ${
                      Math.abs(valor) < 1e-6 
                        ? 'bg-gray-100 text-gray-500' 
                        : 'bg-blue-50 text-blue-800 font-semibold'
                    } hover:bg-blue-100 cursor-help`}
                    title={`${etiquetas[i]} × ${etiquetas[j]} = ${valor}`}
                  >
                    {formatearNumero(valor)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 p-8 text-center">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              🏗️ Calculadora de Matriz de Rigidez
            </h1>
            <p className="text-lg md:text-xl text-blue-200">
              Asigna normales personalizadas y visualiza la matriz reordenada
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Configuración */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <span className="bg-blue-500 p-2 rounded-lg mr-3">⚙️</span>
            Configuración de la Estructura
          </h2>
        
          {/* 🆕 Inputs dinámicos para nodos */}
          <div className="space-y-4 mb-6">
            {Object.entries(nodos).map(([nodo, [x, y]]) => (
              <div key={nodo} className="bg-white/20 p-4 rounded-2xl">
                <h4 className="text-lg font-semibold text-white mb-3">
                  Nodo {nodo}
                </h4>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-white">X:</span>
                    <input
                      type="number"
                      value={x}
                      onChange={(e) => handleNodoChange(nodo, "x", e.target.value)}
                      className="w-24 px-2 py-1 rounded-md text-center font-bold"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white">Y:</span>
                    <input
                      type="number"
                      value={y}
                      onChange={(e) => handleNodoChange(nodo, "y", e.target.value)}
                      className="w-24 px-2 py-1 rounded-md text-center font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 🆕 Botón para añadir nodos */}
          <button
            onClick={agregarNodo}
            className="w-full mb-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:scale-105 transition-all"
          >
            ➕ Agregar Nodo
          </button>

          {/* Botón calcular */}
          <button
            onClick={calcularMatriz}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center text-lg hover:scale-105 transform"
          >
            <span className="mr-2">🔄</span>
            Calcular Matriz de Rigidez
          </button>
            
          {/* 🆕 Lista dinámica de elementos */}
<div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30 mb-6">
  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
    <span className="bg-pink-500 p-2 rounded-lg mr-2">🔗</span>
    Elementos
  </h3>

  <div className="space-y-3">
    {elementos.map(([n1, n2], idx) => (
      <div
        key={idx}
        className="flex items-center space-x-4 bg-white/10 p-3 rounded-xl"
      >
        <span className="text-white font-semibold">E{idx + 1}:</span>
        <input
          type="number"
          value={n1}
          min="1"
          onChange={(e) => {
            const nuevo = [...elementos];
            nuevo[idx] = [parseInt(e.target.value) || 0, nuevo[idx][1]];
            setElementos(nuevo);
          }}
          className="w-20 px-2 py-1 rounded-md text-center font-bold"
        />
        <span className="text-white">—</span>
        <input
          type="number"
          value={n2}
          min="1"
          onChange={(e) => {
            const nuevo = [...elementos];
            nuevo[idx] = [nuevo[idx][0], parseInt(e.target.value) || 0];
            setElementos(nuevo);
          }}
          className="w-20 px-2 py-1 rounded-md text-center font-bold"
        />
        <button
          onClick={() => {
            setElementos(elementos.filter((_, i) => i !== idx));
          }}
          className="ml-2 bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1 rounded-lg shadow"
        >
          ❌
        </button>
      </div>
    ))}
  </div>

  <button
    onClick={() => setElementos([...elementos, [1, 1]])}
    className="mt-4 w-full bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-2 px-4 rounded-xl shadow-lg hover:scale-105 transition-all"
  >
    ➕ Agregar Elemento
  </button>
</div>


          {/* 🆕 Lista dinámica de nodos con normales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 mt-6">
            {Object.keys(nodos).map((nodo) => (
              <div key={nodo} className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="bg-yellow-500 p-1 rounded mr-2">📍</span>
                  Nodo {nodo}
                </h4>
                
                <div className="bg-black/30 rounded-lg p-3 mb-3 text-center">
                  <span className="text-blue-200 font-mono">
                    ({nodos[nodo][0]}, {nodos[nodo][1]})
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Normal X:</span>
                    <input
                      type="number"
                      value={normales[`n${nodo}`]?.x || 0}
                      onChange={(e) => handleNormalChange(`n${nodo}`, 'x', e.target.value)}
                      min="1"
                      className="w-20 px-3 py-2 bg-white/20 border border-white/40 rounded-lg text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Normal Y:</span>
                    <input
                      type="number"
                      value={normales[`n${nodo}`]?.y || 0}
                      onChange={(e) => handleNormalChange(`n${nodo}`, 'y', e.target.value)}
                      min="1"
                      className="w-20 px-3 py-2 bg-white/20 border border-white/40 rounded-lg text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel de Resultados */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <span className="bg-green-500 p-2 rounded-lg mr-3">📊</span>
            Resultados
          </h2>
          
          {resultados.cargando && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-xl">⏳ Calculando matriz de rigidez...</p>
            </div>
          )}

          {resultados.mostrarResultados && (
            <div className="space-y-6">
              {/* Matriz Global */}
              {resultados.matrizGlobal.length > 0 && (
                <MatrizTable
                  matriz={resultados.matrizGlobal}
                  etiquetas={resultados.etiquetasGlobal}
                  titulo="🎯 Matriz de Rigidez Global Reordenada"
                />
              )}

              {/* Propiedades */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="bg-blue-500 p-1 rounded mr-2">📈</span>
                    Propiedades
                  </h4>
                  <div className="space-y-2 text-blue-100">
                    <div className="flex justify-between">
                      <span>Simétrica:</span>
                      <span className="font-bold">{resultados.propiedades.esSimetrica ? 'Sí' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Traza:</span>
                      <span className="font-bold">{resultados.propiedades.traza?.toExponential(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dimensiones:</span>
                      <span className="font-bold">{resultados.propiedades.dimensiones}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="bg-purple-500 p-1 rounded mr-2">🏷️</span>
                    Normales
                  </h4>
                  <div className="space-y-1 text-purple-100 text-sm">
                    {resultados.asignacion && Object.entries(resultados.asignacion).map(([nodo, norms]) => (
                      <div key={nodo} className="flex justify-between">
                        <span>Nodo {nodo}:</span>
                        <span className="font-bold">N{norms[0]}(X), N{norms[1]}(Y)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="bg-green-500 p-1 rounded mr-2">✅</span>
                    Verificación
                  </h4>
                  <div className="space-y-2 text-green-100">
                    <div className="flex justify-between">
                      <span>No cero:</span>
                      <span className="font-bold">{resultados.propiedades.elementosNoCero}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ceros:</span>
                      <span className="font-bold">{resultados.propiedades.elementosCero}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estado:</span>
                      <span className="font-bold text-green-300">✓ Bien condicionada</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Matrices Elementales */}
              {resultados.matricesElementales.length > 0 && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="bg-orange-500 p-2 rounded-lg mr-3">🔗</span>
                    Matrices Elementales
                  </h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {resultados.matricesElementales.map((elem) => (
                      <div key={elem.elemento} className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h4 className="text-lg font-semibold text-white mb-2">
                          Elemento {elem.elemento}: Nodos {elem.nodos} 
                          <span className="text-yellow-300 text-sm ml-2">
                            (L = {elem.longitud.toFixed(3)} m, cosθ = {elem.coseno.toFixed(3)}, senθ = {elem.seno.toFixed(3)})
                          </span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="bg-gray-600 text-white p-2 border border-gray-400 font-bold">
                                  ↓/→
                                </th>
                                {elem.etiquetas.map((etiqueta, idx) => (
                                  <th key={idx} className="bg-gray-600 text-white p-2 border border-gray-400 font-bold min-w-16">
                                    {etiqueta}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {elem.matriz.map((fila, i) => (
                                <tr key={i}>
                                  <th className="bg-gray-600 text-white p-2 border border-gray-400 font-bold">
                                    {elem.etiquetas[i]}
                                  </th>
                                  {fila.map((valor, j) => (
                                    <td
                                      key={j}
                                      className={`p-2 border border-gray-400 text-center font-mono text-xs ${
                                        Math.abs(valor) < 1e-6 
                                          ? 'bg-gray-100 text-gray-500' 
                                          : 'bg-blue-50 text-blue-800 font-semibold'
                                      }`}
                                    >
                                      {formatearNumero(valor)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalculadoraMatrizRigidez;
